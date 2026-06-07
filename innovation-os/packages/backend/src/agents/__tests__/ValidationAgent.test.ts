import * as fc from 'fast-check';
import { ValidationAgent } from '../ValidationAgent';
import { AgentParseError } from '../../lib/errors';
import { IdeaData } from '@innovationos/shared';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    validationResult: { create: jest.fn() },
    validationRisk: { createMany: jest.fn() },
    validationRecommendation: { createMany: jest.fn() },
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIFTY_WORDS =
  'This is a sufficiently long explanation that contains at least fifty words to satisfy the minimum word count requirement set by the Zod schema for validation explanations in this agent.';

const makeAgent = () => new ValidationAgent('project-test-123');

const SAMPLE_IDEA: IdeaData = {
  id: 'idea-1',
  title: 'EduConnect',
  description: 'A platform connecting students with mentors',
  problemStatement: 'Students struggle to find experienced mentors in their field',
  targetAudience: 'University students',
  industry: 'Education',
  goals: 'Connect 10,000 students with mentors in the first year',
};

function makeValidOutput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    innovationScore: 75,
    problemClarityScore: 80,
    marketDemandScore: 70,
    technicalFeasibilityScore: 85,
    innovationExplanation: FIFTY_WORDS,
    problemClarityExplanation: FIFTY_WORDS,
    marketDemandExplanation: FIFTY_WORDS,
    techFeasibilityExplanation: FIFTY_WORDS,
    risks: [
      { title: 'Risk 1', description: 'Risk description one', severity: 'High' },
      { title: 'Risk 2', description: 'Risk description two', severity: 'Medium' },
      { title: 'Risk 3', description: 'Risk description three', severity: 'Low' },
    ],
    recommendations: [
      { title: 'Rec 1', description: 'Recommendation description one', impactRank: 1 },
      { title: 'Rec 2', description: 'Recommendation description two', impactRank: 2 },
      { title: 'Rec 3', description: 'Recommendation description three', impactRank: 3 },
    ],
    dataSourceAttribution: 'Expert domain knowledge and market research frameworks',
    ...overrides,
  };
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('ValidationAgent.buildPrompt()', () => {
  it('includes the idea title, industry, and required JSON field names in the prompt', () => {
    const agent = makeAgent();
    const prompt = agent.buildPrompt(SAMPLE_IDEA);

    expect(prompt).toContain(SAMPLE_IDEA.title);
    expect(prompt).toContain(SAMPLE_IDEA.industry);

    // Verify all required JSON field names are present
    expect(prompt).toContain('innovationScore');
    expect(prompt).toContain('problemClarityScore');
    expect(prompt).toContain('marketDemandScore');
    expect(prompt).toContain('technicalFeasibilityScore');
    expect(prompt).toContain('innovationExplanation');
    expect(prompt).toContain('problemClarityExplanation');
    expect(prompt).toContain('marketDemandExplanation');
    expect(prompt).toContain('techFeasibilityExplanation');
    expect(prompt).toContain('risks');
    expect(prompt).toContain('recommendations');
    expect(prompt).toContain('dataSourceAttribution');
  });
});

describe('ValidationAgent.parseOutput()', () => {
  it('successfully parses valid JSON matching the schema', () => {
    const agent = makeAgent();
    const validOutput = makeValidOutput();
    const raw = JSON.stringify(validOutput);

    const result = agent.parseOutput(raw);

    expect(result.innovationScore).toBe(75);
    expect(result.problemClarityScore).toBe(80);
    expect(result.risks).toHaveLength(3);
    expect(result.recommendations).toHaveLength(3);
    expect(result.dataSourceAttribution).toBeTruthy();
  });

  it('throws AgentParseError when scores are out of range (score=150)', () => {
    const agent = makeAgent();
    const invalid = makeValidOutput({ innovationScore: 150 });
    const raw = JSON.stringify(invalid);

    expect(() => agent.parseOutput(raw)).toThrow(AgentParseError);
    expect(() => agent.parseOutput(raw)).toThrow(/innovationScore/);
  });

  it('throws AgentParseError when fewer than 3 risks are provided', () => {
    const agent = makeAgent();
    const invalid = makeValidOutput({
      risks: [
        { title: 'Risk 1', description: 'Only one risk', severity: 'High' },
        { title: 'Risk 2', description: 'Only two risks', severity: 'Low' },
      ],
    });
    const raw = JSON.stringify(invalid);

    expect(() => agent.parseOutput(raw)).toThrow(AgentParseError);
  });

  it('throws AgentParseError when an invalid severity value is used', () => {
    const agent = makeAgent();
    const invalid = makeValidOutput({
      risks: [
        { title: 'Risk 1', description: 'Risk one', severity: 'Critical' }, // invalid
        { title: 'Risk 2', description: 'Risk two', severity: 'Medium' },
        { title: 'Risk 3', description: 'Risk three', severity: 'Low' },
      ],
    });
    const raw = JSON.stringify(invalid);

    expect(() => agent.parseOutput(raw)).toThrow(AgentParseError);
  });
});

// ─── Property Tests ───────────────────────────────────────────────────────────

/**
 * Validates: Requirements 4 — Score range invariant
 *
 * Property 4: For any ValidationOutput with scores in [0,100],
 * parseOutput succeeds and all scores are integers in [0,100].
 */
describe('Property 4 — score range invariant', () => {
  it('parseOutput always succeeds and scores stay in [0,100] for valid inputs', () => {
    const agent = makeAgent();

    // Arbitraries for scores: integers in [0, 100]
    const scoreArb = fc.integer({ min: 0, max: 100 });

    // Arbitrary for explanation strings of at least 50 chars
    const explanationArb = fc
      .string({ minLength: 10, maxLength: 30 })
      .map((s) => s.padEnd(50, ' x'));

    // Arbitrary for a valid risk
    const riskArb = fc.record({
      title: fc.string({ minLength: 1, maxLength: 30 }),
      description: fc.string({ minLength: 1, maxLength: 50 }),
      severity: fc.constantFrom('High' as const, 'Medium' as const, 'Low' as const),
    });

    // Arbitrary for a valid recommendation
    const recommendationArb = fc.record({
      title: fc.string({ minLength: 1, maxLength: 30 }),
      description: fc.string({ minLength: 1, maxLength: 50 }),
      impactRank: fc.integer({ min: 1, max: 10 }),
    });

    fc.assert(
      fc.property(
        scoreArb,
        scoreArb,
        scoreArb,
        scoreArb,
        explanationArb,
        explanationArb,
        explanationArb,
        explanationArb,
        fc.array(riskArb, { minLength: 3, maxLength: 6 }),
        fc.array(recommendationArb, { minLength: 3, maxLength: 6 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (
          innovationScore,
          problemClarityScore,
          marketDemandScore,
          technicalFeasibilityScore,
          innovationExplanation,
          problemClarityExplanation,
          marketDemandExplanation,
          techFeasibilityExplanation,
          risks,
          recommendations,
          dataSourceAttribution
        ) => {
          const raw = JSON.stringify({
            innovationScore,
            problemClarityScore,
            marketDemandScore,
            technicalFeasibilityScore,
            innovationExplanation,
            problemClarityExplanation,
            marketDemandExplanation,
            techFeasibilityExplanation,
            risks,
            recommendations,
            dataSourceAttribution,
          });

          const result = agent.parseOutput(raw);

          // All scores must be integers in [0, 100]
          expect(result.innovationScore).toBeGreaterThanOrEqual(0);
          expect(result.innovationScore).toBeLessThanOrEqual(100);
          expect(Number.isInteger(result.innovationScore)).toBe(true);

          expect(result.problemClarityScore).toBeGreaterThanOrEqual(0);
          expect(result.problemClarityScore).toBeLessThanOrEqual(100);
          expect(Number.isInteger(result.problemClarityScore)).toBe(true);

          expect(result.marketDemandScore).toBeGreaterThanOrEqual(0);
          expect(result.marketDemandScore).toBeLessThanOrEqual(100);
          expect(Number.isInteger(result.marketDemandScore)).toBe(true);

          expect(result.technicalFeasibilityScore).toBeGreaterThanOrEqual(0);
          expect(result.technicalFeasibilityScore).toBeLessThanOrEqual(100);
          expect(Number.isInteger(result.technicalFeasibilityScore)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Validates: Requirements 6 — Structural completeness
 *
 * Property 6: For any valid ValidationOutput, there are ≥3 risks each with
 * title/description/severity, and ≥3 recommendations each with impactRank ≥ 1.
 */
describe('Property 6 — structural completeness', () => {
  it('parsed output always has ≥3 risks and ≥3 recommendations with required fields', () => {
    const agent = makeAgent();

    const explanationArb = fc
      .string({ minLength: 10, maxLength: 30 })
      .map((s) => s.padEnd(50, ' x'));

    const riskArb = fc.record({
      title: fc.string({ minLength: 1, maxLength: 30 }),
      description: fc.string({ minLength: 1, maxLength: 50 }),
      severity: fc.constantFrom('High' as const, 'Medium' as const, 'Low' as const),
    });

    const recommendationArb = fc.record({
      title: fc.string({ minLength: 1, maxLength: 30 }),
      description: fc.string({ minLength: 1, maxLength: 50 }),
      impactRank: fc.integer({ min: 1, max: 10 }),
    });

    fc.assert(
      fc.property(
        fc.array(riskArb, { minLength: 3, maxLength: 8 }),
        fc.array(recommendationArb, { minLength: 3, maxLength: 8 }),
        explanationArb,
        (risks, recommendations, explanation) => {
          const raw = JSON.stringify({
            innovationScore: 50,
            problemClarityScore: 50,
            marketDemandScore: 50,
            technicalFeasibilityScore: 50,
            innovationExplanation: explanation,
            problemClarityExplanation: explanation,
            marketDemandExplanation: explanation,
            techFeasibilityExplanation: explanation,
            risks,
            recommendations,
            dataSourceAttribution: 'test attribution',
          });

          const result = agent.parseOutput(raw);

          // Structural completeness: ≥3 risks
          expect(result.risks.length).toBeGreaterThanOrEqual(3);
          result.risks.forEach((risk) => {
            expect(risk.title).toBeTruthy();
            expect(risk.description).toBeTruthy();
            expect(['High', 'Medium', 'Low']).toContain(risk.severity);
          });

          // Structural completeness: ≥3 recommendations
          expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
          result.recommendations.forEach((rec) => {
            expect(rec.title).toBeTruthy();
            expect(rec.description).toBeTruthy();
            expect(rec.impactRank).toBeGreaterThanOrEqual(1);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
