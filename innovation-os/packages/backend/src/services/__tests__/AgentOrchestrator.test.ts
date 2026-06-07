/**
 * AgentOrchestrator tests
 *
 * Feature: innovation-os, Property 10: Agent Retry Idempotence
 * Validates: Requirements 2.8
 */

import { AgentOrchestrator } from '../AgentOrchestrator';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../lib/prisma', () => ({
  prisma: {
    agentRun: {
      update: jest.fn().mockResolvedValue({}),
    },
    projectWorkspace: {
      findUniqueOrThrow: jest.fn(),
    },
  },
}));

jest.mock('../SSEBroadcaster', () => ({
  sseBroadcaster: {
    broadcast: jest.fn(),
  },
}));

jest.mock('../HooksEngine', () => ({
  hooksEngine: {
    dispatch: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock agent constructors — all return a mock instance
const mockExecute = jest.fn().mockResolvedValue({ agentType: 'validation', data: {} });

jest.mock('../../agents/ValidationAgent', () => ({
  ValidationAgent: jest.fn().mockImplementation(() => ({ execute: mockExecute })),
}));
jest.mock('../../agents/CompetitorAgent', () => ({
  CompetitorAgent: jest.fn().mockImplementation(() => ({ execute: mockExecute })),
}));
jest.mock('../../agents/RoadmapAgent', () => ({
  RoadmapAgent: jest.fn().mockImplementation(() => ({ execute: mockExecute })),
}));
jest.mock('../../agents/FeasibilityEngine', () => ({
  FeasibilityEngine: jest.fn().mockImplementation(() => ({ execute: mockExecute })),
}));

import { prisma } from '../../lib/prisma';
import { sseBroadcaster } from '../SSEBroadcaster';
import { hooksEngine } from '../HooksEngine';
import { ValidationAgent } from '../../agents/ValidationAgent';
import { CompetitorAgent } from '../../agents/CompetitorAgent';
import { RoadmapAgent } from '../../agents/RoadmapAgent';
import { FeasibilityEngine } from '../../agents/FeasibilityEngine';

// Use any-cast to escape Prisma's strict return type on the mock
const mockAgentRunUpdate = (prisma.agentRun.update as unknown) as jest.Mock;
const mockProjectFind = (prisma.projectWorkspace.findUniqueOrThrow as unknown) as jest.Mock;
const mockBroadcast = jest.mocked(sseBroadcaster.broadcast);
const mockDispatch = jest.mocked(hooksEngine.dispatch);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_PROJECT = {
  id: 'project-1',
  title: 'Test Idea',
  description: 'Description',
  problemStatement: 'Problem',
  targetAudience: 'Students',
  industry: 'Technology',
  goals: 'Build something',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockResolvedValue({ agentType: 'validation', data: {} });
  mockProjectFind.mockResolvedValue(MOCK_PROJECT as any);
  mockAgentRunUpdate.mockResolvedValue({} as any);
});

describe('AgentOrchestrator.runAgent()', () => {
  it('calls setStatus("running") before agent.execute()', async () => {
    const orch = new AgentOrchestrator();

    // Track call order
    const callOrder: string[] = [];
    mockAgentRunUpdate.mockImplementation(async () => {
      callOrder.push('db.update');
      return {};
    });
    mockExecute.mockImplementation(async () => {
      callOrder.push('agent.execute');
      return { agentType: 'validation', data: {} };
    });

    await orch.runAgent('project-1', 'validation');

    // First update should be 'running'
    expect(mockAgentRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'running' }),
      })
    );
    // setStatus('running') must be the very first DB update call
    const runningCallIdx = mockAgentRunUpdate.mock.calls.findIndex(
      (c: any[]) => (c[0] as any).data.status === 'running'
    );
    expect(runningCallIdx).toBe(0);
    expect(callOrder[0]).toBe('db.update');
    expect(callOrder[1]).toBe('agent.execute');
  });

  it('calls setStatus("completed") and broadcasts agent_status:completed after success', async () => {
    const orch = new AgentOrchestrator();

    await orch.runAgent('project-1', 'validation');

    expect(mockAgentRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed' }),
      })
    );
    expect(mockBroadcast).toHaveBeenCalledWith(
      'project-1',
      'agent_status',
      expect.objectContaining({ agentType: 'validation', status: 'completed' })
    );
  });

  it('dispatches agent.completed hook after success', async () => {
    const orch = new AgentOrchestrator();

    await orch.runAgent('project-1', 'validation');

    expect(mockDispatch).toHaveBeenCalledWith({
      name: 'agent.completed',
      projectId: 'project-1',
      payload: { agentType: 'validation' },
    });
  });

  it('calls setStatus("failed") when agent throws — does NOT re-throw', async () => {
    const orch = new AgentOrchestrator();
    mockExecute.mockRejectedValue(new Error('agent error'));

    // Should NOT throw
    await expect(orch.runAgent('project-1', 'validation')).resolves.toBeUndefined();

    expect(mockAgentRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', errorMessage: 'agent error' }),
      })
    );
  });

  it('broadcasts agent_status:failed with errorMessage on failure', async () => {
    const orch = new AgentOrchestrator();
    mockExecute.mockRejectedValue(new Error('execution failed'));

    await orch.runAgent('project-1', 'competitor');

    expect(mockBroadcast).toHaveBeenCalledWith(
      'project-1',
      'agent_status',
      expect.objectContaining({ status: 'failed', errorMessage: 'execution failed' })
    );
  });
});

describe('AgentOrchestrator.retryAgent()', () => {
  it('calls prisma.agentRun.update to reset the record, then calls runAgent', async () => {
    const orch = new AgentOrchestrator();

    await orch.retryAgent('project-1', 'validation');

    // First call should be the reset
    expect(mockAgentRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId_agentType: { projectId: 'project-1', agentType: 'validation' } },
        data: expect.objectContaining({
          status: 'pending',
          errorMessage: null,
          startedAt: null,
          completedAt: null,
        }),
      })
    );

    // Then runAgent should have been called (which will call update again with 'running')
    expect(mockAgentRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'running' }),
      })
    );
  });
});

describe('AgentOrchestrator.instantiateAgent()', () => {
  it('returns ValidationAgent for "validation"', () => {
    const orch = new AgentOrchestrator();
    orch.instantiateAgent('p1', 'validation');
    expect(ValidationAgent).toHaveBeenCalledWith('p1');
  });

  it('returns CompetitorAgent for "competitor"', () => {
    const orch = new AgentOrchestrator();
    orch.instantiateAgent('p1', 'competitor');
    expect(CompetitorAgent).toHaveBeenCalledWith('p1');
  });

  it('returns RoadmapAgent for "roadmap"', () => {
    const orch = new AgentOrchestrator();
    orch.instantiateAgent('p1', 'roadmap');
    expect(RoadmapAgent).toHaveBeenCalledWith('p1');
  });

  it('returns FeasibilityEngine for "feasibility"', () => {
    const orch = new AgentOrchestrator();
    orch.instantiateAgent('p1', 'feasibility');
    expect(FeasibilityEngine).toHaveBeenCalledWith('p1');
  });

  it('throws for unknown agent type', () => {
    const orch = new AgentOrchestrator();
    expect(() => orch.instantiateAgent('p1', 'unknown-agent')).toThrow('Unknown agent type: unknown-agent');
  });
});

// ─── Property Test: Agent Retry Idempotence ───────────────────────────────────
// Feature: innovation-os, Property 10: Agent Retry Idempotence
// Validates: Requirements 2.8

import * as fc from 'fast-check';

describe('Property 10 — Agent Retry Idempotence', () => {
  it('retrying a failed agent updates the existing AgentRun (update called), NOT creates a new workspace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          projectId: fc.uuid(),
          agentType: fc.oneof(
            fc.constant('validation'),
            fc.constant('competitor'),
            fc.constant('roadmap'),
            fc.constant('feasibility')
          ),
        }),
        async ({ projectId, agentType }) => {
          jest.clearAllMocks();
          mockExecute.mockResolvedValue({ agentType, data: {} });
          mockProjectFind.mockResolvedValue({ ...MOCK_PROJECT, id: projectId } as any);
          mockAgentRunUpdate.mockResolvedValue({} as any);

          // Track create calls
          const createMock = jest.fn();
          (prisma.projectWorkspace as any).create = createMock;
          (prisma.agentRun as any).create = createMock;

          const orch = new AgentOrchestrator();
          const updateCallsBefore = mockAgentRunUpdate.mock.calls.length;

          await orch.retryAgent(projectId, agentType);

          const updateCallsAfter = mockAgentRunUpdate.mock.calls.length;

          // agentRun.update must have been called at least once more (the reset)
          expect(updateCallsAfter).toBeGreaterThan(updateCallsBefore);

          // agentRun.create must NOT have been called
          expect(createMock).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  }, 30_000);
});
