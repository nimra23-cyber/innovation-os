/**
 * HooksEngine tests
 *
 * Feature: innovation-os, Property 14: Hook Dispatch Completeness
 * Validates: Requirements 20.4, 20.6
 */

import * as fsMock from 'fs/promises';
import { HooksEngine, HookConfig, HookEvent } from '../HooksEngine';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('fs/promises');
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: jest.fn(),
  },
}));

import { featureFlags } from '../../config/featureFlags';

const mockReaddir = fsMock.readdir as jest.MockedFunction<typeof fsMock.readdir>;
const mockReadFile = fsMock.readFile as jest.MockedFunction<typeof fsMock.readFile>;
const mockIsEnabled = jest.mocked(featureFlags.isEnabled);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEngine() {
  return new HooksEngine();
}

function mockOrchestrator() {
  return { runAgent: jest.fn().mockResolvedValue(undefined) };
}

function mockReportGenerator() {
  return { generate: jest.fn().mockResolvedValue(undefined) };
}

function hookJson(config: Partial<HookConfig> & { enabled: boolean }): string {
  return JSON.stringify(config);
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockIsEnabled.mockReturnValue(false);
});

describe('HooksEngine.loadHooks()', () => {
  it('loads enabled hooks and ignores disabled ones', async () => {
    const engine = makeEngine();
    const orch = mockOrchestrator();
    engine.setOrchestrator(orch);

    mockReaddir.mockResolvedValue(['enabled.json', 'disabled.json'] as any);
    mockReadFile
      .mockResolvedValueOnce(hookJson({
        id: 'h1', event: 'idea.submitted', enabled: true,
        action: { type: 'trigger_agent', target: 'validation' }
      }) as any)
      .mockResolvedValueOnce(hookJson({
        id: 'h2', event: 'idea.submitted', enabled: false,
        action: { type: 'trigger_agent', target: 'validation' }
      }) as any);

    await engine.loadHooks('/fake/dir');

    // Only the enabled hook should fire on dispatch
    await engine.dispatch({ name: 'idea.submitted', projectId: 'p1' });
    expect(orch.runAgent).toHaveBeenCalledTimes(1);
  });

  it('logs error and skips hooks with missing required fields', async () => {
    const engine = makeEngine();

    mockReaddir.mockResolvedValue(['bad.json', 'good.json'] as any);
    mockReadFile
      // Missing action field — invalid
      .mockResolvedValueOnce(JSON.stringify({ id: 'bad', event: 'x', enabled: true }) as any)
      .mockResolvedValueOnce(hookJson({
        id: 'good', event: 'idea.submitted', enabled: true,
        action: { type: 'trigger_agent', target: 'validation' }
      }) as any);

    const orch = mockOrchestrator();
    engine.setOrchestrator(orch);

    await engine.loadHooks('/fake/dir');

    // Only the good hook should load
    await engine.dispatch({ name: 'idea.submitted', projectId: 'p1' });
    expect(orch.runAgent).toHaveBeenCalledTimes(1);

    const { logger } = require('../../lib/logger');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ file: 'bad.json' }),
      expect.stringContaining('missing required fields')
    );
  });
});

describe('HooksEngine.dispatch()', () => {
  async function loadSingleHook(engine: HooksEngine, hook: Partial<HookConfig> & { enabled: boolean }) {
    mockReaddir.mockResolvedValue(['hook.json'] as any);
    mockReadFile.mockResolvedValueOnce(hookJson(hook) as any);
    await engine.loadHooks('/fake/dir');
  }

  it('fires matching hooks based on event name', async () => {
    const engine = makeEngine();
    const orch = mockOrchestrator();
    engine.setOrchestrator(orch);

    await loadSingleHook(engine, {
      id: 'h1', event: 'idea.submitted', enabled: true,
      action: { type: 'trigger_agent', target: 'validation' }
    });

    await engine.dispatch({ name: 'idea.submitted', projectId: 'p1' });
    expect(orch.runAgent).toHaveBeenCalledWith('p1', 'validation');
  });

  it('does NOT fire hooks that do not match event name', async () => {
    const engine = makeEngine();
    const orch = mockOrchestrator();
    engine.setOrchestrator(orch);

    await loadSingleHook(engine, {
      id: 'h1', event: 'idea.submitted', enabled: true,
      action: { type: 'trigger_agent', target: 'validation' }
    });

    await engine.dispatch({ name: 'agent.completed', projectId: 'p1', payload: { agentType: 'validation' } });
    expect(orch.runAgent).not.toHaveBeenCalled();
  });

  it('evaluates agentType condition — fires on match', async () => {
    const engine = makeEngine();
    const orch = mockOrchestrator();
    engine.setOrchestrator(orch);

    await loadSingleHook(engine, {
      id: 'h1', event: 'agent.completed', enabled: true,
      conditions: { agentType: 'validation' },
      action: { type: 'trigger_agent', target: 'competitor' }
    });

    await engine.dispatch({ name: 'agent.completed', projectId: 'p1', payload: { agentType: 'validation' } });
    expect(orch.runAgent).toHaveBeenCalledWith('p1', 'competitor');
  });

  it('evaluates agentType condition — skips on mismatch', async () => {
    const engine = makeEngine();
    const orch = mockOrchestrator();
    engine.setOrchestrator(orch);

    await loadSingleHook(engine, {
      id: 'h1', event: 'agent.completed', enabled: true,
      conditions: { agentType: 'validation' },
      action: { type: 'trigger_agent', target: 'competitor' }
    });

    await engine.dispatch({ name: 'agent.completed', projectId: 'p1', payload: { agentType: 'competitor' } });
    expect(orch.runAgent).not.toHaveBeenCalled();
  });

  it('evaluates featureFlag condition — fires when flag is enabled', async () => {
    const engine = makeEngine();
    const orch = mockOrchestrator();
    engine.setOrchestrator(orch);

    mockIsEnabled.mockReturnValue(true);

    await loadSingleHook(engine, {
      id: 'h1', event: 'idea.submitted', enabled: true,
      conditions: { featureFlag: 'FUNDING_AGENT_ENABLED' },
      action: { type: 'trigger_agent', target: 'funding' }
    });

    await engine.dispatch({ name: 'idea.submitted', projectId: 'p1' });
    expect(orch.runAgent).toHaveBeenCalledWith('p1', 'funding');
  });

  it('evaluates featureFlag condition — skips when flag is disabled', async () => {
    const engine = makeEngine();
    const orch = mockOrchestrator();
    engine.setOrchestrator(orch);

    mockIsEnabled.mockReturnValue(false);

    await loadSingleHook(engine, {
      id: 'h1', event: 'idea.submitted', enabled: true,
      conditions: { featureFlag: 'FUNDING_AGENT_ENABLED' },
      action: { type: 'trigger_agent', target: 'funding' }
    });

    await engine.dispatch({ name: 'idea.submitted', projectId: 'p1' });
    expect(orch.runAgent).not.toHaveBeenCalled();
  });

  it('re-throws when hook action throws', async () => {
    const engine = makeEngine();
    const orch = { runAgent: jest.fn().mockRejectedValue(new Error('agent boom')) };
    engine.setOrchestrator(orch);

    await loadSingleHook(engine, {
      id: 'h1', event: 'idea.submitted', enabled: true,
      action: { type: 'trigger_agent', target: 'validation' }
    });

    await expect(engine.dispatch({ name: 'idea.submitted', projectId: 'p1' }))
      .rejects.toThrow('agent boom');
  });

  it('calls orchestrator.runAgent() for trigger_agent hooks', async () => {
    const engine = makeEngine();
    const orch = mockOrchestrator();
    engine.setOrchestrator(orch);

    await loadSingleHook(engine, {
      id: 'h1', event: 'idea.submitted', enabled: true,
      action: { type: 'trigger_agent', target: 'validation' }
    });

    await engine.dispatch({ name: 'idea.submitted', projectId: 'proj-42' });
    expect(orch.runAgent).toHaveBeenCalledWith('proj-42', 'validation');
  });

  it('calls reportGenerator.generate() for generate_report hooks', async () => {
    const engine = makeEngine();
    const rg = mockReportGenerator();
    engine.setReportGenerator(rg);

    await loadSingleHook(engine, {
      id: 'h1', event: 'agent.completed', enabled: true,
      action: { type: 'generate_report', target: 'startup_intelligence_report' }
    });

    await engine.dispatch({ name: 'agent.completed', projectId: 'proj-99', payload: {} });
    expect(rg.generate).toHaveBeenCalledWith('proj-99');
  });

  it('per-target featureFlag: roadmap fires (no flag), funding skips (flag off), mentor skips (flag off)', async () => {
    const engine = makeEngine();
    const orch = mockOrchestrator();
    engine.setOrchestrator(orch);

    // funding and mentor flags are disabled (mockIsEnabled returns false by default)
    mockIsEnabled.mockReturnValue(false);

    mockReaddir.mockResolvedValue(['on-competitor-completed.json'] as any);
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      id: 'on-competitor-completed',
      event: 'agent.completed',
      conditions: { agentType: 'competitor' },
      action: {
        type: 'trigger_agent',
        target: ['roadmap', 'funding', 'mentor'],
        parallel: true,
        conditions: {
          funding: { featureFlag: 'FUNDING_AGENT_ENABLED' },
          mentor: { featureFlag: 'MENTOR_AGENT_ENABLED' }
        }
      },
      enabled: true
    }) as any);

    await engine.loadHooks('/fake/dir');
    await engine.dispatch({ name: 'agent.completed', projectId: 'p1', payload: { agentType: 'competitor' } });

    // Only roadmap should fire — funding and mentor are gated by disabled flags
    expect(orch.runAgent).toHaveBeenCalledTimes(1);
    expect(orch.runAgent).toHaveBeenCalledWith('p1', 'roadmap');
  });
});

// ─── Property Test: Hook Dispatch Completeness ───────────────────────────────
// Feature: innovation-os, Property 14: Hook Dispatch Completeness
// Validates: Requirements 20.4, 20.6

import * as fc from 'fast-check';

describe('Property 14 — Hook Dispatch Completeness', () => {
  it('all matching+enabled hooks fire; no non-matching or disabled hook fires', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate an array of hook configs
        fc.array(
          fc.record({
            id: fc.uuid(),
            event: fc.oneof(
              fc.constant('idea.submitted'),
              fc.constant('agent.completed'),
              fc.constant('project.created')
            ),
            enabled: fc.boolean(),
            agentType: fc.option(
              fc.oneof(
                fc.constant('validation'),
                fc.constant('competitor'),
                fc.constant('roadmap')
              ),
              { nil: undefined }
            ),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        // Generate a dispatched event
        fc.record({
          eventName: fc.oneof(
            fc.constant('idea.submitted'),
            fc.constant('agent.completed'),
            fc.constant('project.created')
          ),
          payloadAgentType: fc.option(
            fc.oneof(
              fc.constant('validation'),
              fc.constant('competitor'),
              fc.constant('roadmap')
            ),
            { nil: undefined }
          ),
        }),
        async (hookDefs, dispatchedEvent) => {
          jest.clearAllMocks();
          mockIsEnabled.mockReturnValue(false);

          const engine = new HooksEngine();
          const orch = mockOrchestrator();
          engine.setOrchestrator(orch);

          // Build mock filesystem from hookDefs
          const fileNames = hookDefs.map((h, i) => `hook-${i}.json`);
          mockReaddir.mockResolvedValue(fileNames as any);

          hookDefs.forEach((h) => {
            const config: any = {
              id: h.id,
              event: h.event,
              enabled: h.enabled,
              action: { type: 'trigger_agent', target: 'roadmap' },
            };
            if (h.agentType !== undefined) {
              config.conditions = { agentType: h.agentType };
            }
            mockReadFile.mockResolvedValueOnce(JSON.stringify(config) as any);
          });

          await engine.loadHooks('/fake/dir');

          const payload: Record<string, unknown> = {};
          if (dispatchedEvent.payloadAgentType !== undefined) {
            payload.agentType = dispatchedEvent.payloadAgentType;
          }

          await engine.dispatch({
            name: dispatchedEvent.eventName,
            projectId: 'test-project',
            payload,
          });

          // Compute expected matching hooks
          const expectedFires = hookDefs.filter(h => {
            if (!h.enabled) return false;
            if (h.event !== dispatchedEvent.eventName) return false;
            if (h.agentType !== undefined) {
              return h.agentType === dispatchedEvent.payloadAgentType;
            }
            return true;
          });

          expect(orch.runAgent).toHaveBeenCalledTimes(expectedFires.length);
        }
      ),
      { numRuns: 100 }
    );
  }, 30_000);
});
