import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { reportGenerator } from '../services/ReportGenerator';
import { NotFoundError } from '../lib/errors';

export const reportsRouter = Router();

// ─── GET /:projectId — Get report ─────────────────────────────────────────────

reportsRouter.get('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const report = await prisma.startupIntelligenceReport.findUnique({
      where: { projectId },
      include: {
        project: {
          include: {
            validationResult: {
              include: {
                risks: true,
                recommendations: true,
              },
            },
            competitorAnalysis: {
              include: { competitors: true },
            },
            roadmapPhases: {
              orderBy: { order: 'asc' },
              include: {
                milestones: {
                  include: { deliverables: true },
                },
              },
            },
            feasibilityScore: true,
          },
        },
      },
    });

    if (!report) {
      return res.status(202).json({ data: null, status: 'pending' });
    }

    // Parse keyRecommendations from JSON string
    const keyRecommendations: string[] = JSON.parse(report.keyRecommendations);

    // Reshape competitor SWOT from JSON strings
    const competitor = report.project.competitorAnalysis
      ? {
          ...report.project.competitorAnalysis,
          swot: {
            strengths: JSON.parse(report.project.competitorAnalysis.swotStrengths),
            weaknesses: JSON.parse(report.project.competitorAnalysis.swotWeaknesses),
            opportunities: JSON.parse(report.project.competitorAnalysis.swotOpportunities),
            threats: JSON.parse(report.project.competitorAnalysis.swotThreats),
          },
          marketOpportunities: JSON.parse(report.project.competitorAnalysis.marketOpportunities),
          competitiveAdvantages: JSON.parse(
            report.project.competitorAnalysis.competitiveAdvantages
          ),
        }
      : null;

    res.json({
      data: {
        id: report.id,
        projectId: report.projectId,
        executiveSummary: report.executiveSummary,
        keyRecommendations,
        generatedAt: report.generatedAt,
        updatedAt: report.updatedAt,
        validation: report.project.validationResult,
        competitor,
        roadmap: { phases: report.project.roadmapPhases },
        feasibility: report.project.feasibilityScore,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:projectId/regenerate — Trigger report regeneration ────────────────

reportsRouter.post('/:projectId/regenerate', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.projectWorkspace.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError(`Project not found: ${projectId}`);
    }

    // Generate in background — do NOT await
    reportGenerator.generate(projectId).catch(() => {
      // Non-blocking
    });

    res.status(202).json({ data: { accepted: true } });
  } catch (err) {
    next(err);
  }
});
