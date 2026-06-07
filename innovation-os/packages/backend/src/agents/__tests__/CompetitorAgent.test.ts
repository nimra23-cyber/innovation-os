import * as fc from 'fast-check';
import { CompetitorAgent } from '../CompetitorAgent';
import { AgentParseError } from '../../lib/errors';
import { IdeaData } from '@innovationos/shared';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    competitorAnalysis: { create: jest.fn() },
    competitor: { createMany: jest.fn() },
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

const makeAgent = () => new CompetitorAgent('project-test-123');

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
    competitors: [
      {
        name: 'MentorCruise',
        description: 'A platform connecting professionals with mentors for career growth',
        category: 'Direct',
        url: 'https://mentorcruise.com',
      },
      {
        name: 'LinkedIn Learning',
        description: 'Online learning platform with courses but limited mentor access',
        category: 'Indirect',
      },
      {
        name: 'Udemy',
        description: 'On-demand learning platform that serves as an alternative to mentorship',
        category: 'Substitute',
      },
    ],
    swot: {
      strengths: ['Student-focused approach', 'University network integration'],
      weaknesses: ['Limited initial mentor pool', 'Monetization complexity'],
      opportunities: ['Growing demand for mentorship', 'University partnership potential'],
      threats: ['Established competitors with large user bases', 'Mentor churn risk'],
    },
    marketOpportunities: [
      'Underserved university student segment',
      'Niche focus on academic-to-career transitions',
    ],
    competitiveAdvantages: [
      'Deep integration with university systems',
      'Student-centric UX tailored for academic workflows',
    ],
    dataSourceAttribution: 'Market research frameworks and domain expertise in EdTech',
    ...overrides,
  };
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('CompetitorAgent.buildPrompt()', () => {
  it('includes the idea title, industry, and required JSON field names in the prompt', () => {
    const agent = makeAgent();
    const prompt = agent.buildPrompt(SAMPLE_IDEA);

    expect(prompt).toContain(SAMPLE_IDEA.title);
    expect(prompt).toContain(SAMPLE_IDEA.industry);

    // Verify all required JSON field names are present
    expect(prompt).toContain('competitors');
    expect(prompt).toContain('swot');
    expect(prompt).toContain('marketOpportunities');
    expect(prompt).toContain('competitiveAdvantages');
    expect(prompt).toContain('dataSourceAttribution');
  });
});

describe('CompetitorAgent.parseOutput()', () => {
  it('successfully parses a valid JSON string with 3 competitors and complete SWOT', () => {
    const agent = makeAgent();
    const validOutput = makeValidOutput();
    const raw = JSON.stringify(validOutput);

    const result = agent.parseOutput(raw);

    expect(result.competitors).toHaveLength(3);
    expect(result.swot.strengths.length).toBeGreaterThanOrEqual(2);
    expect(result.swot.weaknesses.length).toBeGreaterThanOrEqual(2);
    expect(result.swot.opportunities.length).toBeGreaterThanOrEqual(2);
    expect(result.swot.threats.length).toBeGreaterThanOrEqual(2);
    expect(result.marketOpportunities.length).toBeGreaterThanOrEqual(2);
    expect(result.competitiveAdvantages.length).toBeGreaterThanOrEqual(2);
    expect(result.dataSourceAttribution).toBeTruthy();
  });

  it('throws AgentParseError when fewer than 3 competitors are provided', () => {
    const agent = makeAgent();
    const invalid = makeValidOutput({
      competitors: [
        {
          name: 'Only Competitor',
          description: 'Just one competitor',
          category: 'Direct',
        },
        {
          name: 'Second Competitor',
          description: 'Only two competitors',
          category: 'Indirect',
        },
      ],
    });
    const raw = JSON.stringify(invalid);

    expect(() => agent.parseOutput(raw)).toThrow(AgentParseError);
  });

  it('throws AgentParseError when SWOT strengths has fewer than 2 items', () => {
    const agent = makeAgent();
    const invalid = makeValidOutput({
      swot: {
        strengths: ['Only one strength'],
        weaknesses: ['Weakness one', 'Weakness two'],
        opportunities: ['Opportunity one', 'Opportunity two'],
        threats: ['Threat one', 'Threat two'],
      },
    });
    const raw = JSON.stringify(invalid);

    expect(() => agent.parseOutput(raw)).toThrow(AgentParseError);
  });

  it('throws AgentParseError when an invalid category value is used', () => {
    const agent = makeAgent();
    const invalid = makeValidOutput({
      competitors: [
        {
          name: 'Competitor A',
          description: 'Valid competitor description',
          category: 'Unknown', // invalid category
        },
        {
          name: 'Competitor B',
          description: 'Another valid description',
          category: 'Direct',
        },
        {
          name: 'Competitor C',
          description: 'Third valid description',
          category: 'Indirect',
        },
      ],
    });
    const raw = JSON.stringify(invalid);

    expect(() => agent.parseOutput(raw)).toThrow(AgentParseError);
  });
});

// ─── Property Tests ───────────────────────────────────────────────────────────

/**
 * Feature: innovation-os, Property 6: Agent Output Structural Completeness (Competitor)
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 *
 * Property 6: For any valid CompetitorOutput, the parsed result must have
 * ≥3 competitors with valid categories, each SWOT quadrant ≥2 items,
 * ≥2 market opportunities, and ≥2 competitive advantages.
 */
describe('Property 6 — competitor structural completeness', () => {
  it('parsed output always satisfies structural completeness for valid inputs', () => {
    const agent = makeAgent();

    const validCategories = ['Direct', 'Indirect', 'Substitute'] as const;

    const competitorArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 40 }),
      description: fc.string({ minLength: 1, maxLength: 100 }),
      category: fc.constantFrom(...validCategories),
      url: fc.option(fc.webUrl(), { nil: undefined }),
    });

    const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 80 });

    fc.assert(
      fc.property(
        fc.array(competitorArb, { minLength: 3, maxLength: 6 }),
        fc.array(nonEmptyStringArb, { minLength: 2, maxLength: 5 }),
        fc.array(nonEmptyStringArb, { minLength: 2, maxLength: 5 }),
        fc.array(nonEmptyStringArb, { minLength: 2, maxLength: 5 }),
        fc.array(nonEmptyStringArb, { minLength: 2, maxLength: 5 }),
        fc.array(nonEmptyStringArb, { minLength: 2, maxLength: 5 }),
        fc.array(nonEmptyStringArb, { minLength: 2, maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 80 }),
        (
          competitors,
          strengths,
          weaknesses,
          opportunities,
          threats,
          marketOpportunities,
          competitiveAdvantages,
          dataSourceAttribution
        ) => {
          const raw = JSON.stringify({
            competitors,
            swot: { strengths, weaknesses, opportunities, threats },
            marketOpportunities,
            competitiveAdvantages,
            dataSourceAttribution,
          });

          const result = agent.parseOutput(raw);

          // ≥3 competitors with valid categories
          expect(result.competitors.length).toBeGreaterThanOrEqual(3);
          result.competitors.forEach((c) => {
            expect(['Direct', 'Indirect', 'Substitute']).toContain(c.category);
            expect(c.name).toBeTruthy();
            expect(c.description).toBeTruthy();
          });

          // Each SWOT quadrant ≥2 items
          expect(result.swot.strengths.length).toBeGreaterThanOrEqual(2);
          expect(result.swot.weaknesses.length).toBeGreaterThanOrEqual(2);
          expect(result.swot.opportunities.length).toBeGreaterThanOrEqual(2);
          expect(result.swot.threats.length).toBeGreaterThanOrEqual(2);

          // ≥2 market opportunities and ≥2 competitive advantages
          expect(result.marketOpportunities.length).toBeGreaterThanOrEqual(2);
          expect(result.competitiveAdvantages.length).toBeGreaterThanOrEqual(2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
