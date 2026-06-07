import { BaseAgent, AgentOutput } from '../BaseAgent';
import { AgentType, IdeaData } from '@innovationos/shared';
import { LLMClient } from '../../services/LLMClient';
import { SteeringLoader } from '../../services/SteeringLoader';

// Mock SteeringLoader so we never hit the filesystem
jest.mock('../../services/SteeringLoader', () => ({
  SteeringLoader: {
    loadAll: jest.fn(),
  },
}));

// Mock logger to suppress pino output and allow assertions
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { logger } from '../../lib/logger';

// Type-safe references using jest.mocked()
const mockLoadAll = jest.mocked(SteeringLoader.loadAll);
const infoSpy = jest.mocked(logger.info);

// ─── Concrete test subclass ───────────────────────────────────────────────────

interface TestOutput {
  result: string;
}

class TestAgent extends BaseAgent<TestOutput> {
  readonly agentType: AgentType = 'validation';

  // Track call order
  callOrder: string[] = [];

  // Captured steering context at buildPrompt call time (for assertion in tests)
  capturedSteeringAtBuildPrompt: string | undefined;

  buildPrompt(idea: IdeaData): string {
    this.callOrder.push('buildPrompt');
    this.capturedSteeringAtBuildPrompt = this.steeringContext;
    return `Prompt for ${idea.title}`;
  }

  parseOutput(raw: string): TestOutput {
    this.callOrder.push('parseOutput');
    return { result: raw };
  }

  async persistOutput(_projectId: string, _output: TestOutput): Promise<void> {
    this.callOrder.push('persistOutput');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_IDEA: IdeaData = {
  id: 'project-123',
  title: 'Test Idea',
  description: 'A test idea description',
  problemStatement: 'A test problem',
  targetAudience: 'Developers',
  industry: 'Technology',
  goals: 'Build something great',
};

function makeMockLLMClient(response = '{"mocked":"true"}'): LLMClient {
  return {
    complete: jest.fn().mockResolvedValue(response),
  } as unknown as LLMClient;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadAll.mockResolvedValue('## Steering: guide.md\n\nSome steering content');
});

describe('BaseAgent.execute()', () => {
  it('calls init → buildPrompt → llmClient.complete → parseOutput → persistOutput in order', async () => {
    const mockLLM = makeMockLLMClient('{"result":"llm_response"}');
    const agent = new TestAgent('project-123', mockLLM);

    await agent.execute(MOCK_IDEA);

    expect(agent.callOrder).toEqual(['buildPrompt', 'parseOutput', 'persistOutput']);
    // init() is implicitly verified by the fact that steeringContext was loaded before buildPrompt
    expect(mockLoadAll).toHaveBeenCalledTimes(1);
    expect(mockLLM.complete).toHaveBeenCalledTimes(1);
  });

  it('sets steeringContext from SteeringLoader.loadAll() before buildPrompt is called', async () => {
    const steeringContent = '## Steering: ethical-ai.md\n\nEthical AI guidance';
    mockLoadAll.mockResolvedValue(steeringContent);

    const agent = new TestAgent('project-123', makeMockLLMClient());

    await agent.execute(MOCK_IDEA);

    // capturedSteeringAtBuildPrompt is set inside buildPrompt() — proves steering was loaded first
    expect(agent.capturedSteeringAtBuildPrompt).toBe(steeringContent);
  });

  it('passes steeringContext and prompt to llmClient.complete', async () => {
    const steeringContent = '## Steering: guide.md\n\nGuidance content';
    mockLoadAll.mockResolvedValue(steeringContent);

    const mockLLM = makeMockLLMClient('{}');
    const agent = new TestAgent('project-123', mockLLM);

    await agent.execute(MOCK_IDEA);

    expect(mockLLM.complete).toHaveBeenCalledWith(
      steeringContent,
      `Prompt for ${MOCK_IDEA.title}`
    );
  });

  it('returns AgentOutput with the correct agentType and data', async () => {
    const mockLLM = makeMockLLMClient('{"result":"the_output"}');
    const agent = new TestAgent('project-123', mockLLM);

    const output: AgentOutput<TestOutput> = await agent.execute(MOCK_IDEA);

    expect(output.agentType).toBe('validation');
    expect(output.data).toEqual({ result: '{"result":"the_output"}' });
  });

  it('propagates an error thrown by parseOutput', async () => {
    const parseError = new Error('Parse failed');
    const mockLLM = makeMockLLMClient('bad json');

    class ThrowingParseAgent extends TestAgent {
      parseOutput(_raw: string): TestOutput {
        throw parseError;
      }
    }

    const agent = new ThrowingParseAgent('project-123', mockLLM);
    await expect(agent.execute(MOCK_IDEA)).rejects.toThrow('Parse failed');
  });

  it('propagates an error thrown by persistOutput', async () => {
    const persistError = new Error('DB write failed');
    const mockLLM = makeMockLLMClient('{"result":"ok"}');

    class ThrowingPersistAgent extends TestAgent {
      async persistOutput(_projectId: string, _output: TestOutput): Promise<void> {
        throw persistError;
      }
    }

    const agent = new ThrowingPersistAgent('project-123', mockLLM);
    await expect(agent.execute(MOCK_IDEA)).rejects.toThrow('DB write failed');
  });

  it('logs info at agent start and completion', async () => {
    const agent = new TestAgent('project-123', makeMockLLMClient());

    await agent.execute(MOCK_IDEA);

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ agentType: 'validation', projectId: 'project-123' }),
      'Agent starting'
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ agentType: 'validation', projectId: 'project-123' }),
      'Agent completed successfully'
    );
  });

  it('uses the injected LLMClient rather than the singleton when provided', async () => {
    const mockLLM = makeMockLLMClient('{"injected":true}');
    const agent = new TestAgent('project-abc', mockLLM);

    await agent.execute(MOCK_IDEA);

    expect(mockLLM.complete).toHaveBeenCalledTimes(1);
  });
});
