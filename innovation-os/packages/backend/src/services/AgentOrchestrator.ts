import { AgentType, AgentStatus, IdeaData } from '@innovationos/shared';
import { BaseAgent } from '../agents/BaseAgent';
import { ValidationAgent } from '../agents/ValidationAgent';
import { CompetitorAgent } from '../agents/CompetitorAgent';
import { RoadmapAgent } from '../agents/RoadmapAgent';
import { FeasibilityEngine } from '../agents/FeasibilityEngine';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { sseBroadcaster } from './SSEBroadcaster';
import { hooksEngine } from './HooksEngine';

export class AgentOrchestrator {

  async runAgent(projectId: string, agentType: string): Promise<void> {
    await this.setStatus(projectId, agentType, 'running', { startedAt: new Date() });
    sseBroadcaster.broadcast(projectId, 'agent_status', {
      agentType, status: 'running', timestamp: new Date().toISOString()
    });

    // Time remaining ticker — estimate 60s per agent, tick every 10s
    let elapsed = 0;
    const ESTIMATE_SECONDS = 60;
    const ticker = setInterval(() => {
      elapsed += 10;
      const remaining = Math.max(0, ESTIMATE_SECONDS - elapsed);
      sseBroadcaster.broadcast(projectId, 'time_remaining', { agentType, estimatedSeconds: remaining });
    }, 10_000);

    try {
      const idea = await this.getIdeaData(projectId);
      const agent = this.instantiateAgent(projectId, agentType);
      await agent.execute(idea);

      clearInterval(ticker);
      await this.setStatus(projectId, agentType, 'completed', { completedAt: new Date() });
      sseBroadcaster.broadcast(projectId, 'agent_status', {
        agentType, status: 'completed', timestamp: new Date().toISOString()
      });

      await hooksEngine.dispatch({
        name: 'agent.completed',
        projectId,
        payload: { agentType }
      });

    } catch (error) {
      clearInterval(ticker);
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ agentType, projectId, error }, 'Agent execution failed');

      await this.setStatus(projectId, agentType, 'failed', {
        completedAt: new Date(),
        errorMessage: message
      });
      sseBroadcaster.broadcast(projectId, 'agent_status', {
        agentType, status: 'failed', errorMessage: message, timestamp: new Date().toISOString()
      });
      // Does NOT re-throw — non-blocking
    }
  }

  async retryAgent(projectId: string, agentType: string): Promise<void> {
    // Reset the existing AgentRun record without creating a new workspace
    await prisma.agentRun.update({
      where: { projectId_agentType: { projectId, agentType } },
      data: {
        status: 'pending',
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      }
    });
    await this.runAgent(projectId, agentType);
  }

  instantiateAgent(projectId: string, agentType: string): BaseAgent<unknown> {
    switch (agentType) {
      case 'validation': return new ValidationAgent(projectId);
      case 'competitor': return new CompetitorAgent(projectId);
      case 'roadmap': return new RoadmapAgent(projectId);
      case 'feasibility': return new FeasibilityEngine(projectId);
      default: throw new Error(`Unknown agent type: ${agentType}`);
    }
  }

  private async getIdeaData(projectId: string): Promise<IdeaData> {
    const project = await prisma.projectWorkspace.findUniqueOrThrow({
      where: { id: projectId }
    });
    return {
      id: project.id,
      title: project.title,
      description: project.description,
      problemStatement: project.problemStatement,
      targetAudience: project.targetAudience,
      industry: project.industry as IdeaData['industry'],
      goals: project.goals,
    };
  }

  private async setStatus(
    projectId: string,
    agentType: string,
    status: AgentStatus,
    options?: { errorMessage?: string; startedAt?: Date; completedAt?: Date }
  ): Promise<void> {
    await prisma.agentRun.update({
      where: { projectId_agentType: { projectId, agentType } },
      data: {
        status,
        ...(options?.errorMessage !== undefined && { errorMessage: options.errorMessage }),
        ...(options?.startedAt && { startedAt: options.startedAt }),
        ...(options?.completedAt && { completedAt: options.completedAt }),
      }
    });
  }
}

export const agentOrchestrator = new AgentOrchestrator();
