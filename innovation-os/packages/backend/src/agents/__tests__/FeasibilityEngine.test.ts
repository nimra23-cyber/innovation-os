import * as fc from 'fast-check';
import { FeasibilityEngine } from '../FeasibilityEngine';
import { AgentParseError } from '../../lib/errors';
import { computeLaunchReadiness } from '../../config/scoringWeights';
import { IdeaData } from '@innovationos/shared';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../lib/prisma', () => ({
  prisma: {
    validationResult: { findUnique: jest.fn() },
    feasibilityScore: { create: jest.fn() },
  },
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../services/SteeringLoader', () => ({
  SteeringLoader: {
    loadAll: jest.fn().mockResolvedValue(''),
  },
}));

// ─── Mock references (accessed after jest.mock hoisting) ─────────────────────

import { prisma } from '../../lib/prisma';

// Typed mock helpers
const mockValidationResultFindUnique = prisma.validationResult.findUnique as jest.Mock;
const mockFeasibilityScoreCreate = prisma.feasibilityScore.create as jest.Mock;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** 40+ character explanation string */
const FORTY_CHARS =
  'This explanation is sufficiently long to satisfy the minimum forty-character requirement for feasibility explanations.';

const makeEngine = () => new FeasibilityEngine('project-test-123');

const SAMPLE_IDEA: IdeaData = {
  id: 'idea-1',
  title: 'EduConnect',
  description: 'A platform connecting students with mentors',
  problemStatement: 'Students struggle to find experienced mentors in their field',
  targetAudience: 'University students',
  industry: 'Education',
  goals: 'Connect 10,000 students with mentors in the first year',
};

function makeValidLLMOutput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    technicalScore: 70,
    marketScore: 75,
    financialScore: 65,
    technicalExplanation: FORTY_CHARS,
    marketExplanation: FORTY_CHARS,
    financialExplanation: FORTY_CHARS,
    innovationExplanation: FORTY_CHARS,
    launchReadinessExplanation: FORTY_CHARS,
    dataSourceAttribution: 'Domain knowledge and industry research frameworks',
    ...overrides,
  };
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('FeasibilityEngine.parseOutput() / parseLLMOutput()', () => {
  it('successfully parses valid JSON matching the schema', () => {
    const engine = makeEngine();
    const raw = JSON.stringify(makeValidLLMOutput());

    const result = engine.parseOutput(raw);

    expect(result.technicalScore).toBe(70);
    expect(result.marketScore).toBe(75);
    expect(result.financialScore).toBe(65);
    expect(result.technicalExplanation).toBe(FORTY_CHARS);
  });

  it('throws AgentParseError when technicalScore is out of range (e.g. 150)', () => {
    const engine = makeEngine();
    const invalid = makeValidLLMOutput({ technicalScore: 150 });
    const raw = JSON.stringify(invalid);

    expect(() => engine.parseOutput(raw)).toThrow(AgentParseError);
    expect(() => engine.parseOutput(raw)).toThrow(/technicalScore/);
  });

  it('throws AgentParseError when marketScore is out of range (e.g. -5)', () => {
    const engine = makeEngine();
    const invalid = makeValidLLMOutput({ marketScore: -5 });
    const raw = JSON.stringify(invalid);

    expect(() => engine.parseOutput(raw)).toThrow(AgentParseError);
  });

  it('throws AgentParseError when explanations are under 40 characters', () => {
    const engine = makeEngine();
    const invalid = makeValidLLMOutput({ technicalExplanation: 'Too short' });
    const raw = JSON.stringify(invalid);

    expect(() => engine.parseOutput(raw)).toThrow(AgentParseError);
    expect(() => engine.parseOutput(raw)).toThrow(/technicalExplanation/);
  });

  it('throws AgentParseError when innovationExplanation is under 40 characters', () => {
    const engine = makeEngine();
    const invalid = makeValidLLMOutput({ innovationExplanation: 'Short' });
    const raw = JSON.stringify(invalid);

    expect(() => engine.parseOutput(raw)).toThrow(AgentParseError);
  });

  it('throws AgentParseError when required fields are missing', () => {
    const engine = makeEngine();
    // Missing dataSourceAttribution
    const { dataSourceAttribution: _omit, ...noAttribution } = makeValidLLMOutput() as Record<
      string,
      unknown
    >;
    const raw = JSON.stringify(noAttribution);

    expect(() => engine.parseOutput(raw)).toThrow(AgentParseError);
  });
});

describe('FeasibilityEngine.execute() — launchReadinessScore computation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeasibilityScoreCreate.mockResolvedValue({});
  });

  it('computes launchReadinessScore via computeLaunchReadiness(), not from LLM', async () => {
    const innovationScore = 80;
    mockValidationResultFindUnique.mockResolvedValue({ innovationScore });

    const llmOutput = makeValidLLMOutput({
      technicalScore: 70,
      marketScore: 75,
      financialScore: 65,
    });

    const mockLLMClient = {
      complete: jest.fn().mockResolvedValue(JSON.stringify(llmOutput)),
    };

    const engine = new FeasibilityEngine('project-test-123', mockLLMClient as any);

    const result = await engine.execute(SAMPLE_IDEA);

    // launchReadinessScore must match the formula output
    const expectedLaunchReadiness = computeLaunchReadiness(70, 75, 65, innovationScore);
    expect(result.data.launchReadinessScore).toBe(expectedLaunchReadiness);

    // Confirm it was NOT taken from the LLM response (LLM output has no launchReadinessScore field)
    expect((llmOutput as Record<string, unknown>)['launchReadinessScore']).toBeUndefined();
  });

  it('launchReadinessScore is clamped to [0, 100]', async () => {
    const innovationScore = 100;
    mockValidationResultFindUnique.mockResolvedValue({ innovationScore });

    const llmOutput = makeValidLLMOutput({
      technicalScore: 100,
      marketScore: 100,
      financialScore: 100,
    });

    const mockLLMClient = {
      complete: jest.fn().mockResolvedValue(JSON.stringify(llmOutput)),
    };

    const engine = new FeasibilityEngine('project-test-123', mockLLMClient as any);

    const result = await engine.execute(SAMPLE_IDEA);

    expect(result.data.launchReadinessScore).toBeGreaterThanOrEqual(0);
    expect(result.data.launchReadinessScore).toBeLessThanOrEqual(100);
  });
});

describe('FeasibilityEngine.execute() — innovationScore from DB', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeasibilityScoreCreate.mockResolvedValue({});
  });

  it('uses innovationScore from DB, not from LLM response', async () => {
    const dbInnovationScore = 72;
    mockValidationResultFindUnique.mockResolvedValue({ innovationScore: dbInnovationScore });

    // LLM output intentionally does NOT include innovationScore —
    // it should never come from the LLM in this agent
    const llmOutput = makeValidLLMOutput();
    expect((llmOutput as Record<string, unknown>)['innovationScore']).toBeUndefined();

    const mockLLMClient = {
      complete: jest.fn().mockResolvedValue(JSON.stringify(llmOutput)),
    };

    const engine = new FeasibilityEngine('project-test-123', mockLLMClient as any);

    const result = await engine.execute(SAMPLE_IDEA);

    expect(result.data.innovationScore).toBe(dbInnovationScore);
  });

  it('throws when ValidationResult is not found in DB', async () => {
    mockValidationResultFindUnique.mockResolvedValue(null);

    const mockLLMClient = {
      complete: jest.fn().mockResolvedValue(JSON.stringify(makeValidLLMOutput())),
    };

    const engine = new FeasibilityEngine('project-test-123', mockLLMClient as any);

    await expect(engine.execute(SAMPLE_IDEA)).rejects.toThrow(
      'ValidationResult not found for project project-test-123'
    );
  });

  it('persists output to feasibilityScore table with all fields', async () => {
    const dbInnovationScore = 60;
    mockValidationResultFindUnique.mockResolvedValue({ innovationScore: dbInnovationScore });

    const llmOutput = makeValidLLMOutput({
      technicalScore: 55,
      marketScore: 65,
      financialScore: 50,
    });

    const mockLLMClient = {
      complete: jest.fn().mockResolvedValue(JSON.stringify(llmOutput)),
    };

    const engine = new FeasibilityEngine('project-test-123', mockLLMClient as any);

    await engine.execute(SAMPLE_IDEA);

    expect(mockFeasibilityScoreCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-test-123',
        technicalScore: 55,
        marketScore: 65,
        financialScore: 50,
        innovationScore: dbInnovationScore,
        launchReadinessScore: computeLaunchReadiness(55, 65, 50, dbInnovationScore),
        technicalExplanation: FORTY_CHARS,
        marketExplanation: FORTY_CHARS,
        financialExplanation: FORTY_CHARS,
        innovationExplanation: FORTY_CHARS,
        launchReadinessExplanation: FORTY_CHARS,
      }),
    });
  });
});

// ─── Property Tests ───────────────────────────────────────────────────────────

/**
 * Feature: innovation-os, Property 4: All Agent Score Outputs Are Valid Integers in [0, 100] (Feasibility)
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 *
 * For any valid combination of technicalScore, marketScore, financialScore (all in [0,100])
 * and a valid innovationScore from DB (also in [0,100]), all five output scores must be
 * integers in [0, 100].
 */
describe('Property 4 — All Agent Score Outputs Are Valid Integers in [0, 100] (Feasibility)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeasibilityScoreCreate.mockResolvedValue({});
  });

  it('all five output scores are integers in [0, 100] for any valid input combination', async () => {
    const scoreArb = fc.integer({ min: 0, max: 100 });

    // Arbitrary for explanation strings of at least 40 chars
    const explanationArb = fc
      .string({ minLength: 10, maxLength: 40 })
      .map((s) => s.padEnd(40, ' x'));

    await fc.assert(
      fc.asyncProperty(
        scoreArb, // technicalScore
        scoreArb, // marketScore
        scoreArb, // financialScore
        scoreArb, // innovationScore (from DB)
        explanationArb,
        explanationArb,
        explanationArb,
        explanationArb,
        explanationArb,
        fc.string({ minLength: 1, maxLength: 50 }), // dataSourceAttribution
        async (
          technicalScore,
          marketScore,
          financialScore,
          innovationScore,
          technicalExplanation,
          marketExplanation,
          financialExplanation,
          innovationExplanation,
          launchReadinessExplanation,
          dataSourceAttribution
        ) => {
          mockValidationResultFindUnique.mockResolvedValue({ innovationScore });

          const llmOutput = {
            technicalScore,
            marketScore,
            financialScore,
            technicalExplanation,
            marketExplanation,
            financialExplanation,
            innovationExplanation,
            launchReadinessExplanation,
            dataSourceAttribution,
          };

          const mockLLMClient = {
            complete: jest.fn().mockResolvedValue(JSON.stringify(llmOutput)),
          };

          const engine = new FeasibilityEngine('project-prop-test', mockLLMClient as any);

          const result = await engine.execute(SAMPLE_IDEA);
          const data = result.data;

          // All five scores must be integers in [0, 100]
          const scores = [
            data.technicalScore,
            data.marketScore,
            data.financialScore,
            data.innovationScore,
            data.launchReadinessScore,
          ];

          for (const score of scores) {
            expect(Number.isInteger(score)).toBe(true);
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
