import * as fc from 'fast-check';
import { ReportGenerator } from '../ReportGenerator';
import { NotFoundError } from '../../lib/errors';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../lib/prisma', () => ({
  prisma: {
    projectWorkspace: { findUnique: jest.fn() },
    validationResult: { findUnique: jest.fn() },
    competitorAnalysis: { findUnique: jest.fn() },
    roadmapPhase: { findMany: jest.fn() },
    feasibilityScore: { findUnique: jest.fn() },
    startupIntelligenceReport: { upsert: jest.fn() },
  },
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../LLMClient', () => {
  const mockCompleteText = jest.fn();
  return {
    LLMClient: jest.fn().mockImplementation(() => ({ completeText: mockCompleteText })),
    llmClient: { completeText: mockCompleteText },
    __mockCompleteText: mockCompleteText,
  };
});

// ─── Mock references ─────────────────────────────────────────────────────────

import { prisma } from '../../lib/prisma';

const mockProjectFind = prisma.projectWorkspace.findUnique as jest.Mock;
const mockValidationFind = prisma.validationResult.findUnique as jest.Mock;
const mockCompetitorFind = prisma.competitorAnalysis.findUnique as jest.Mock;
const mockPhasesFind = prisma.roadmapPhase.findMany as jest.Mock;
const mockFeasibilityFind = prisma.feasibilityScore.findUnique as jest.Mock;
const mockUpsert = prisma.startupIntelligenceReport.upsert as jest.Mock;

// Access the shared mock function from the LLMClient mock module
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockCompleteText: jest.Mock = require('../LLMClient').__mockCompleteText;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_PROJECT = {
  id: 'p1',
  title: 'EduConnect',
  industry: 'Education',
  description: 'Desc',
  problemStatement: 'Problem',
  targetAudience: 'Students',
  goals: 'Goals',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_VALIDATION = {
  id: 'v1',
  projectId: 'p1',
  innovationScore: 75,
  problemClarityScore: 80,
  marketDemandScore: 70,
  technicalFeasibilityScore: 85,
  innovationExplanation: 'Innovation explanation text',
  problemClarityExplanation: 'Clarity explanation',
  marketDemandExplanation: 'Market explanation',
  techFeasibilityExplanation: 'Tech explanation',
  dataSourceAttribution: 'Expert knowledge',
  risks: [{ id: 'r1', title: 'Risk 1', description: 'Risk desc', severity: 'High' }],
  recommendations: [
    { id: 'rec1', title: 'Rec 1', description: 'Do this first', impactRank: 1 },
    { id: 'rec2', title: 'Rec 2', description: 'Do this second', impactRank: 2 },
    { id: 'rec3', title: 'Rec 3', description: 'Do this third', impactRank: 3 },
  ],
};

const MOCK_COMPETITOR = {
  id: 'ca1',
  projectId: 'p1',
  swotStrengths: '["S1","S2"]',
  swotWeaknesses: '["W1","W2"]',
  swotOpportunities: '["O1","O2"]',
  swotThreats: '["T1","T2"]',
  marketOpportunities: '["Mo1","Mo2"]',
  competitiveAdvantages: '["Ca1","Ca2"]',
  dataSourceAttribution: 'Research',
  competitors: [{ id: 'c1', name: 'CompA', description: 'Desc', category: 'Direct', url: null }],
};

const MOCK_PHASES = [
  {
    id: 'ph1',
    projectId: 'p1',
    name: 'Research',
    order: 1,
    startWeek: 0,
    endWeek: 4,
    createdAt: new Date(),
    milestones: [
      {
        id: 'm1',
        phaseId: 'ph1',
        title: 'M1',
        description: 'Desc',
        priority: 'High',
        durationWeeks: 2,
        deliverables: [{ id: 'd1', milestoneId: 'm1', title: 'D1', description: 'Deliv' }],
      },
    ],
  },
];

const MOCK_FEASIBILITY = {
  id: 'f1',
  projectId: 'p1',
  technicalScore: 70,
  marketScore: 75,
  financialScore: 65,
  innovationScore: 75,
  launchReadinessScore: 72,
  technicalExplanation: 'Tech OK',
  marketExplanation: 'Market OK',
  financialExplanation: 'Finance OK',
  innovationExplanation: 'Innovation OK',
  launchReadinessExplanation: 'Ready',
  createdAt: new Date(),
};

const MOCK_REPORT = {
  id: 'rpt1',
  projectId: 'p1',
  executiveSummary: 'This is the executive summary.',
  keyRecommendations: '["Rec 1","Rec 2","Rec 3"]',
  generatedAt: new Date(),
  updatedAt: new Date(),
};

// ─── Helper: set up all mocks for a happy-path generate() call ────────────────

function setupHappyPath(overrideCompleteText?: jest.Mock) {
  mockProjectFind.mockResolvedValue(MOCK_PROJECT);
  mockValidationFind.mockResolvedValue(MOCK_VALIDATION);
  mockCompetitorFind.mockResolvedValue(MOCK_COMPETITOR);
  mockPhasesFind.mockResolvedValue(MOCK_PHASES);
  mockFeasibilityFind.mockResolvedValue(MOCK_FEASIBILITY);
  mockUpsert.mockResolvedValue(MOCK_REPORT);
  const completeTextFn = overrideCompleteText ?? mockCompleteText;
  completeTextFn.mockResolvedValue('This is the executive summary.');
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('ReportGenerator', () => {
  let generator: ReportGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new ReportGenerator({ completeText: mockCompleteText } as any);
  });

  // Test 1: generate() calls upsert with correct shape
  it('generate() calls prisma.startupIntelligenceReport.upsert with executiveSummary and keyRecommendations as JSON string', async () => {
    setupHappyPath();

    await generator.generate('p1');

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'p1' },
        create: expect.objectContaining({
          projectId: 'p1',
          executiveSummary: expect.any(String),
          keyRecommendations: expect.any(String),
        }),
        update: expect.objectContaining({
          executiveSummary: expect.any(String),
          keyRecommendations: expect.any(String),
        }),
      })
    );

    // keyRecommendations must be a valid JSON string (array)
    const callArgs = mockUpsert.mock.calls[0][0];
    const parsed = JSON.parse(callArgs.create.keyRecommendations);
    expect(Array.isArray(parsed)).toBe(true);
  });

  // Test 2: generate() calls llm.completeText() to generate the executive summary
  it('generate() calls llm.completeText() to generate the executive summary', async () => {
    setupHappyPath();

    await generator.generate('p1');

    expect(mockCompleteText).toHaveBeenCalledTimes(1);
    expect(mockCompleteText).toHaveBeenCalledWith(
      expect.stringContaining('executive summar'),
      expect.stringContaining('EduConnect')
    );
  });

  // Test 3: generate() trims executiveSummary to ≤300 words
  it('generate() trims executiveSummary to ≤300 words when LLM returns a long response', async () => {
    setupHappyPath();
    // Generate a 400+ word string
    const longSummary = Array(410).fill('word').join(' ');
    mockCompleteText.mockResolvedValue(longSummary);
    mockUpsert.mockImplementation(args => ({
      ...MOCK_REPORT,
      executiveSummary: args.create.executiveSummary,
    }));

    await generator.generate('p1');

    const callArgs = mockUpsert.mock.calls[0][0];
    const words = callArgs.create.executiveSummary.split(/\s+/).filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(300);
  });

  // Test 4: generate() stores keyRecommendations sorted by impactRank ascending
  it('generate() stores keyRecommendations sorted by impactRank ascending (1 = highest)', async () => {
    // Provide recommendations out of order
    const shuffledValidation = {
      ...MOCK_VALIDATION,
      recommendations: [
        { id: 'rec3', title: 'Rec 3', description: 'Third', impactRank: 3 },
        { id: 'rec1', title: 'Rec 1', description: 'First', impactRank: 1 },
        { id: 'rec2', title: 'Rec 2', description: 'Second', impactRank: 2 },
      ],
    };
    mockProjectFind.mockResolvedValue(MOCK_PROJECT);
    mockValidationFind.mockResolvedValue(shuffledValidation);
    mockCompetitorFind.mockResolvedValue(MOCK_COMPETITOR);
    mockPhasesFind.mockResolvedValue(MOCK_PHASES);
    mockFeasibilityFind.mockResolvedValue(MOCK_FEASIBILITY);
    mockUpsert.mockResolvedValue(MOCK_REPORT);
    mockCompleteText.mockResolvedValue('Summary text here.');

    await generator.generate('p1');

    const callArgs = mockUpsert.mock.calls[0][0];
    const recs: string[] = JSON.parse(callArgs.create.keyRecommendations);
    expect(recs).toEqual(['Rec 1', 'Rec 2', 'Rec 3']);
  });

  // Test 5: generate() throws NotFoundError when ValidationResult is missing
  it('generate() throws NotFoundError when ValidationResult is missing', async () => {
    mockProjectFind.mockResolvedValue(MOCK_PROJECT);
    mockValidationFind.mockResolvedValue(null);

    await expect(generator.generate('p1')).rejects.toThrow(NotFoundError);
    await expect(generator.generate('p1')).rejects.toThrow('ValidationResult not found');
  });

  // Test 6: generate() throws NotFoundError when FeasibilityScore is missing
  it('generate() throws NotFoundError when FeasibilityScore is missing', async () => {
    mockProjectFind.mockResolvedValue(MOCK_PROJECT);
    mockValidationFind.mockResolvedValue(MOCK_VALIDATION);
    mockCompetitorFind.mockResolvedValue(MOCK_COMPETITOR);
    mockPhasesFind.mockResolvedValue(MOCK_PHASES);
    mockFeasibilityFind.mockResolvedValue(null);

    await expect(generator.generate('p1')).rejects.toThrow(NotFoundError);
    await expect(generator.generate('p1')).rejects.toThrow('FeasibilityScore not found');
  });

  // Test 7: generate() throws NotFoundError when project itself is not found
  it('generate() throws NotFoundError when project is not found', async () => {
    mockProjectFind.mockResolvedValue(null);

    await expect(generator.generate('missing-id')).rejects.toThrow(NotFoundError);
    await expect(generator.generate('missing-id')).rejects.toThrow('Project not found');
  });

  // Test 8: getFullReportData() correctly parses JSON string fields back to arrays
  it('getFullReportData() parses JSON string fields (swotStrengths etc.) back to arrays', async () => {
    mockProjectFind.mockResolvedValue(MOCK_PROJECT);
    mockValidationFind.mockResolvedValue(MOCK_VALIDATION);
    mockCompetitorFind.mockResolvedValue(MOCK_COMPETITOR);
    mockPhasesFind.mockResolvedValue(MOCK_PHASES);
    mockFeasibilityFind.mockResolvedValue(MOCK_FEASIBILITY);

    const data = await generator.getFullReportData('p1');

    expect(Array.isArray(data.competitor.swot.strengths)).toBe(true);
    expect(data.competitor.swot.strengths).toEqual(['S1', 'S2']);
    expect(Array.isArray(data.competitor.swot.weaknesses)).toBe(true);
    expect(data.competitor.swot.weaknesses).toEqual(['W1', 'W2']);
    expect(Array.isArray(data.competitor.swot.opportunities)).toBe(true);
    expect(data.competitor.swot.opportunities).toEqual(['O1', 'O2']);
    expect(Array.isArray(data.competitor.swot.threats)).toBe(true);
    expect(data.competitor.swot.threats).toEqual(['T1', 'T2']);
    expect(Array.isArray(data.competitor.marketOpportunities)).toBe(true);
    expect(Array.isArray(data.competitor.competitiveAdvantages)).toBe(true);
  });
});

// ─── Property Tests ───────────────────────────────────────────────────────────

/**
 * Feature: innovation-os, Property 12: Report Completeness Invariant
 * Validates: Requirements 7.2
 *
 * For any valid combination of agent outputs, getFullReportData() must return
 * a FullReportData where all 6 sections have non-empty, meaningful values.
 */
describe('Property 12 — Report Completeness Invariant', () => {
  let generator: ReportGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new ReportGenerator({ completeText: mockCompleteText } as any);
  });

  it('getFullReportData() always returns complete data for any valid agent output combination', async () => {
    // Arbitraries for generating varied but valid fixture data
    const nonEmptyStr = fc.string({ minLength: 1, maxLength: 50 });
    const scoreArb = fc.integer({ min: 1, max: 100 });
    const idArb = fc.string({ minLength: 1, maxLength: 20 });
    const severityArb = fc.constantFrom('High', 'Medium', 'Low');
    const priorityArb = fc.constantFrom('High', 'Medium', 'Low');
    const categoryArb = fc.constantFrom('Direct', 'Indirect', 'Substitute');

    const riskArb = fc.record({
      id: idArb,
      title: nonEmptyStr,
      description: nonEmptyStr,
      severity: severityArb,
    });

    const recArb = fc.record({
      id: idArb,
      title: nonEmptyStr,
      description: nonEmptyStr,
      impactRank: fc.integer({ min: 1, max: 10 }),
    });

    const deliverableArb = fc.record({
      id: idArb,
      milestoneId: idArb,
      title: nonEmptyStr,
      description: nonEmptyStr,
    });

    const milestoneArb = fc.record({
      id: idArb,
      phaseId: idArb,
      title: nonEmptyStr,
      description: nonEmptyStr,
      priority: priorityArb,
      durationWeeks: fc.integer({ min: 1, max: 12 }),
      deliverables: fc.array(deliverableArb, { minLength: 1, maxLength: 3 }),
    });

    const phaseArb = fc.record({
      id: idArb,
      projectId: fc.constant('p1'),
      name: nonEmptyStr,
      order: fc.integer({ min: 1, max: 6 }),
      startWeek: fc.integer({ min: 0, max: 20 }),
      endWeek: fc.integer({ min: 1, max: 24 }),
      createdAt: fc.constant(new Date()),
      milestones: fc.array(milestoneArb, { minLength: 1, maxLength: 3 }),
    });

    const competitorArb = fc.record({
      id: idArb,
      name: nonEmptyStr,
      description: nonEmptyStr,
      category: categoryArb,
      url: fc.option(nonEmptyStr, { nil: null }),
    });

    await fc.assert(
      fc.asyncProperty(
        // Project fields
        nonEmptyStr, // title
        nonEmptyStr, // industry
        nonEmptyStr, // description
        nonEmptyStr, // problemStatement
        nonEmptyStr, // targetAudience
        nonEmptyStr, // goals
        // Validation scores
        scoreArb, scoreArb, scoreArb, scoreArb,
        // Risks and recommendations
        fc.array(riskArb, { minLength: 1, maxLength: 5 }),
        fc.array(recArb, { minLength: 1, maxLength: 5 }),
        // Competitor arrays (stored as JSON strings in DB)
        fc.array(nonEmptyStr, { minLength: 1, maxLength: 4 }),
        fc.array(nonEmptyStr, { minLength: 1, maxLength: 4 }),
        fc.array(nonEmptyStr, { minLength: 1, maxLength: 4 }),
        fc.array(nonEmptyStr, { minLength: 1, maxLength: 4 }),
        fc.array(nonEmptyStr, { minLength: 1, maxLength: 4 }),
        fc.array(nonEmptyStr, { minLength: 1, maxLength: 4 }),
        fc.array(competitorArb, { minLength: 1, maxLength: 4 }),
        // Roadmap phases
        fc.array(phaseArb, { minLength: 1, maxLength: 3 }),
        // Feasibility scores
        scoreArb, scoreArb, scoreArb, scoreArb, scoreArb,
        async (
          title, industry, description, problemStatement, targetAudience, goals,
          innovationScore, problemClarityScore, marketDemandScore, technicalFeasibilityScore,
          risks, recommendations,
          swotStrengths, swotWeaknesses, swotOpportunities, swotThreats,
          marketOpportunities, competitiveAdvantages, competitors,
          phases,
          technicalScore, marketScore, financialScore, feasibilityInnovationScore, launchReadinessScore
        ) => {
          const project = { id: 'p1', title, industry, description, problemStatement, targetAudience, goals, createdAt: new Date(), updatedAt: new Date() };
          const validation = {
            id: 'v1', projectId: 'p1',
            innovationScore, problemClarityScore, marketDemandScore, technicalFeasibilityScore,
            innovationExplanation: 'Explanation text here for testing',
            problemClarityExplanation: 'Explanation text here for testing',
            marketDemandExplanation: 'Explanation text here for testing',
            techFeasibilityExplanation: 'Explanation text here for testing',
            dataSourceAttribution: 'Research',
            risks, recommendations,
          };
          const competitorAnalysis = {
            id: 'ca1', projectId: 'p1',
            swotStrengths: JSON.stringify(swotStrengths),
            swotWeaknesses: JSON.stringify(swotWeaknesses),
            swotOpportunities: JSON.stringify(swotOpportunities),
            swotThreats: JSON.stringify(swotThreats),
            marketOpportunities: JSON.stringify(marketOpportunities),
            competitiveAdvantages: JSON.stringify(competitiveAdvantages),
            dataSourceAttribution: 'Research',
            competitors: competitors.map((c, i) => ({ ...c, id: `c${i}`, analysisId: 'ca1' })),
          };
          const feasibility = {
            id: 'f1', projectId: 'p1',
            technicalScore, marketScore, financialScore,
            innovationScore: feasibilityInnovationScore, launchReadinessScore,
            technicalExplanation: 'Tech OK', marketExplanation: 'Market OK',
            financialExplanation: 'Finance OK', innovationExplanation: 'Innovation OK',
            launchReadinessExplanation: 'Ready', createdAt: new Date(),
          };

          mockProjectFind.mockResolvedValue(project);
          mockValidationFind.mockResolvedValue(validation);
          mockCompetitorFind.mockResolvedValue(competitorAnalysis);
          mockPhasesFind.mockResolvedValue(phases);
          mockFeasibilityFind.mockResolvedValue(feasibility);

          const data = await generator.getFullReportData('p1');

          // Project fields are non-empty strings
          expect(data.project.title.length).toBeGreaterThan(0);
          expect(data.project.industry.length).toBeGreaterThan(0);
          expect(data.project.description.length).toBeGreaterThan(0);
          expect(data.project.problemStatement.length).toBeGreaterThan(0);
          expect(data.project.targetAudience.length).toBeGreaterThan(0);
          expect(data.project.goals.length).toBeGreaterThan(0);

          // Validation has scores > 0 and non-empty arrays
          expect(data.validation.innovationScore).toBeGreaterThan(0);
          expect(data.validation.risks.length).toBeGreaterThan(0);
          expect(data.validation.recommendations.length).toBeGreaterThan(0);

          // Competitor has non-empty arrays
          expect(data.competitor.competitors.length).toBeGreaterThan(0);
          expect(data.competitor.swot.strengths.length).toBeGreaterThan(0);
          expect(data.competitor.swot.weaknesses.length).toBeGreaterThan(0);
          expect(data.competitor.swot.opportunities.length).toBeGreaterThan(0);
          expect(data.competitor.swot.threats.length).toBeGreaterThan(0);

          // Roadmap has non-empty phases
          expect(data.roadmap.phases.length).toBeGreaterThan(0);

          // Feasibility has all scores present and non-zero launchReadinessScore
          expect(data.feasibility.technicalScore).toBeGreaterThan(0);
          expect(data.feasibility.marketScore).toBeGreaterThan(0);
          expect(data.feasibility.financialScore).toBeGreaterThan(0);
          expect(data.feasibility.launchReadinessScore).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: innovation-os, Property 13: Executive Summary Length Invariant
 * Validates: Requirements 7.3
 *
 * For any LLM response (even with > 300 words), the persisted executiveSummary
 * must always contain ≤ 300 words.
 */
describe('Property 13 — Executive Summary Length Invariant', () => {
  let generator: ReportGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new ReportGenerator({ completeText: mockCompleteText } as any);
  });

  it('persisted executiveSummary always has ≤ 300 words regardless of LLM output length', async () => {
    // Arbitrary for word-count-controllable strings
    const wordCountArb = fc.integer({ min: 1, max: 500 });
    const wordArb = fc.string({ minLength: 1, maxLength: 15 }).filter(s => !/\s/.test(s) && s.length > 0);

    await fc.assert(
      fc.asyncProperty(
        wordCountArb,
        wordArb,
        async (wordCount, sampleWord) => {
          setupHappyPath();

          // Generate an LLM response with exactly `wordCount` words
          const llmResponse = Array(wordCount).fill(sampleWord || 'word').join(' ');
          mockCompleteText.mockResolvedValue(llmResponse);

          let capturedSummary = '';
          mockUpsert.mockImplementation((args: { create: { executiveSummary: string } }) => {
            capturedSummary = args.create.executiveSummary;
            return Promise.resolve({ ...MOCK_REPORT, executiveSummary: capturedSummary });
          });

          await generator.generate('p1');

          const persistedWords = capturedSummary.split(/\s+/).filter(Boolean);
          expect(persistedWords.length).toBeLessThanOrEqual(300);
        }
      ),
      { numRuns: 100 }
    );
  });
});
