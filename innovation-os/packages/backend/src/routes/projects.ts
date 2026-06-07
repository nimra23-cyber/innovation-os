import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { agentOrchestrator } from '../services/AgentOrchestrator';
import { hooksEngine } from '../services/HooksEngine';
import { validateBody } from '../middleware/validateBody';
import { NotFoundError, ConflictError } from '../lib/errors';
import { INDUSTRIES } from '@innovationos/shared';
import type { AgentType, AgentStatus } from '@innovationos/shared';

export const projectsRouter = Router();

// ─── Schema ───────────────────────────────────────────────────────────────────

const CreateProjectSchema = z.object({
  title: z.string().min(5, 'Min 5 characters').max(120, 'Max 120 characters'),
  description: z.string().min(50, 'Min 50 characters').max(2000, 'Max 2000 characters'),
  problemStatement: z.string().min(20, 'Min 20 characters').max(1000, 'Max 1000 characters'),
  targetAudience: z.string().min(10, 'Min 10 characters').max(500, 'Max 500 characters'),
  industry: z.enum(INDUSTRIES as [string, ...string[]]),
  goals: z.string().min(20, 'Min 20 characters').max(1000, 'Max 1000 characters'),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAgentStatuses(
  agentRuns: Array<{ agentType: string; status: string }>
): Record<AgentType, AgentStatus> {
  const result: Record<string, string> = {};
  for (const run of agentRuns) {
    result[run.agentType] = run.status;
  }
  return result as Record<AgentType, AgentStatus>;
}

// ─── POST / — Create project ──────────────────────────────────────────────────

projectsRouter.post('/', validateBody(CreateProjectSchema), async (req, res, next) => {
  try {
    const { title, description, problemStatement, targetAudience, industry, goals } = req.body;

    const project = await prisma.projectWorkspace.create({
      data: {
        title,
        description,
        problemStatement,
        targetAudience,
        industry,
        goals,
        agentRuns: {
          create: [
            { agentType: 'validation', status: 'pending' },
            { agentType: 'competitor', status: 'pending' },
            { agentType: 'roadmap', status: 'pending' },
            { agentType: 'feasibility', status: 'pending' },
          ],
        },
      },
      include: { agentRuns: true },
    });

    // Dispatch hook in background — do NOT await
    hooksEngine.dispatch({ name: 'idea.submitted', projectId: project.id }).catch(() => {
      // Non-blocking — errors are logged inside hooksEngine
    });

    res.status(201).json({ data: project });
  } catch (err) {
    next(err);
  }
});

// ─── GET / — List all projects ────────────────────────────────────────────────

projectsRouter.get('/', async (_req, res, next) => {
  try {
    const projects = await prisma.projectWorkspace.findMany({
      orderBy: { createdAt: 'desc' },
      include: { agentRuns: true },
    });

    const data = projects.map(p => ({
      ...p,
      agentStatuses: buildAgentStatuses(p.agentRuns),
    }));

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id — Get single project ───────────────────────────────────────────

projectsRouter.get('/:id', async (req, res, next) => {
  try {
    const project = await prisma.projectWorkspace.findUnique({
      where: { id: req.params.id },
      include: { agentRuns: true },
    });

    if (!project) {
      throw new NotFoundError(`Project not found: ${req.params.id}`);
    }

    res.json({
      data: {
        ...project,
        agentStatuses: buildAgentStatuses(project.agentRuns),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/agents — All agent runs for project ─────────────────────────────

projectsRouter.get('/:id/agents', async (req, res, next) => {
  try {
    const project = await prisma.projectWorkspace.findUnique({
      where: { id: req.params.id },
    });
    if (!project) {
      throw new NotFoundError(`Project not found: ${req.params.id}`);
    }

    const agentRuns = await prisma.agentRun.findMany({
      where: { projectId: req.params.id },
    });

    res.json({ data: agentRuns });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/agents/:agentType — Agent run + output ─────────────────────────

projectsRouter.get('/:id/agents/:agentType', async (req, res, next) => {
  try {
    const { id: projectId, agentType } = req.params;

    const agentRun = await prisma.agentRun.findUnique({
      where: { projectId_agentType: { projectId, agentType } },
    });

    if (!agentRun) {
      throw new NotFoundError(`Agent run not found: ${agentType} for project ${projectId}`);
    }

    // If pending or running, return 202 Accepted
    if (agentRun.status === 'pending' || agentRun.status === 'running') {
      return res.status(202).json({ data: agentRun });
    }

    // Fetch agent-specific output
    let output: Record<string, unknown> | null = null;

    if (agentType === 'validation') {
      output = await prisma.validationResult.findUnique({
        where: { projectId },
        include: {
          risks: true,
          recommendations: true,
        },
      }) as Record<string, unknown> | null;
    } else if (agentType === 'competitor') {
      const raw = await prisma.competitorAnalysis.findUnique({
        where: { projectId },
        include: { competitors: true },
      });
      if (raw) {
        output = {
          ...raw,
          swot: {
            strengths: JSON.parse(raw.swotStrengths),
            weaknesses: JSON.parse(raw.swotWeaknesses),
            opportunities: JSON.parse(raw.swotOpportunities),
            threats: JSON.parse(raw.swotThreats),
          },
          marketOpportunities: JSON.parse(raw.marketOpportunities),
          competitiveAdvantages: JSON.parse(raw.competitiveAdvantages),
        };
      }
    } else if (agentType === 'roadmap') {
      const phases = await prisma.roadmapPhase.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
        include: {
          milestones: {
            include: { deliverables: true },
          },
        },
      });
      output = { phases } as Record<string, unknown>;
    } else if (agentType === 'feasibility') {
      output = await prisma.feasibilityScore.findUnique({
        where: { projectId },
      }) as Record<string, unknown> | null;
    }

    res.json({ data: { ...agentRun, output } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/agents/:agentType/retry — Retry agent ─────────────────────────

projectsRouter.post('/:id/agents/:agentType/retry', async (req, res, next) => {
  try {
    const { id: projectId, agentType } = req.params;

    const agentRun = await prisma.agentRun.findUnique({
      where: { projectId_agentType: { projectId, agentType } },
    });

    if (!agentRun) {
      throw new NotFoundError(`Agent run not found: ${agentType} for project ${projectId}`);
    }

    if (agentRun.status === 'running') {
      throw new ConflictError(`Agent ${agentType} is currently running`);
    }

    // Retry in background — do NOT await
    agentOrchestrator.retryAgent(projectId, agentType).catch(() => {
      // Non-blocking
    });

    res.status(202).json({ data: { accepted: true } });
  } catch (err) {
    next(err);
  }
});
