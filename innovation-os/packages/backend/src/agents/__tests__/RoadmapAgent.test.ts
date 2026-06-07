import * as fc from 'fast-check';
import { RoadmapAgent } from '../RoadmapAgent';
import { AgentParseError } from '../../lib/errors';
import { IdeaData } from '@innovationos/shared';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    roadmapPhase: { create: jest.fn() },
    milestone: { create: jest.fn() },
    deliverable: { create: jest.fn() },
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

const makeAgent = () => new RoadmapAgent('project-test-123');

const SAMPLE_IDEA: IdeaData = {
  id: 'idea-1',
  title: 'EduConnect',
  description: 'A platform connecting students with mentors',
  problemStatement: 'Students struggle to find experienced mentors in their field',
  targetAudience: 'University students',
  industry: 'Education',
  goals: 'Connect 10,000 students with mentors in the first year',
};

function makePhase(name: string, order: number, startWeek: number, endWeek: number) {
  return {
    name,
    order,
    startWeek,
    endWeek,
    milestones: [
      {
        title: 'M1',
        description: 'Milestone one description verifiable',
        priority: 'High',
        durationWeeks: 2,
        deliverables: [{ title: 'D1', description: 'Deliverable one' }],
      },
      {
        title: 'M2',
        description: 'Milestone two description verifiable',
        priority: 'Medium',
        durationWeeks: 1,
        deliverables: [{ title: 'D2', description: 'Deliverable two' }],
      },
    ],
  };
}

function makeValidRoadmapOutput() {
  return {
    phases: [
      makePhase('Research', 1, 0, 4),
      makePhase('Validation', 2, 4, 8),
      makePhase('MVP', 3, 8, 16),
      makePhase('Testing', 4, 16, 20),
      makePhase('Launch', 5, 20, 24),
      makePhase('Growth', 6, 24, 36),
    ],
  };
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('RoadmapAgent.buildPrompt()', () => {
  it('contains the idea title, industry, all 6 phase names, and field names milestones and deliverables', () => {
    const agent = makeAgent();
    const prompt = agent.buildPrompt(SAMPLE_IDEA);

    // Idea fields
    expect(prompt).toContain(SAMPLE_IDEA.title);
    expect(prompt).toContain(SAMPLE_IDEA.industry);

    // All 6 phase names
    expect(prompt).toContain('Research');
    expect(prompt).toContain('Validation');
    expect(prompt).toContain('MVP');
    expect(prompt).toContain('Testing');
    expect(prompt).toContain('Launch');
    expect(prompt).toContain('Growth');

    // Key field names
    expect(prompt).toContain('milestones');
    expect(prompt).toContain('deliverables');
  });
});

describe('RoadmapAgent.parseOutput()', () => {
  it('successfully parses a valid roadmap JSON', () => {
    const agent = makeAgent();
    const raw = JSON.stringify(makeValidRoadmapOutput());

    const result = agent.parseOutput(raw);

    expect(result.phases).toHaveLength(6);
    expect(result.phases[0].name).toBe('Research');
    expect(result.phases[5].name).toBe('Growth');
    result.phases.forEach((phase, i) => {
      expect(phase.order).toBe(i + 1);
      expect(phase.milestones.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('throws AgentParseError when phases are in wrong order (Research and Validation swapped)', () => {
    const agent = makeAgent();
    const swapped = makeValidRoadmapOutput();
    // Swap Research and Validation (both name and order)
    swapped.phases[0] = makePhase('Validation', 1, 0, 4);
    swapped.phases[1] = makePhase('Research', 2, 4, 8);
    const raw = JSON.stringify(swapped);

    expect(() => agent.parseOutput(raw)).toThrow(AgentParseError);
  });

  it('throws AgentParseError when a phase has endWeek <= startWeek', () => {
    const agent = makeAgent();
    const invalid = makeValidRoadmapOutput();
    // Set endWeek equal to startWeek for Research phase
    invalid.phases[0] = makePhase('Research', 1, 4, 4);
    const raw = JSON.stringify(invalid);

    expect(() => agent.parseOutput(raw)).toThrow(AgentParseError);
  });

  it('throws AgentParseError when a phase has fewer than 2 milestones', () => {
    const agent = makeAgent();
    const invalid = makeValidRoadmapOutput();
    // Replace milestones with only 1
    invalid.phases[2] = {
      ...makePhase('MVP', 3, 8, 16),
      milestones: [
        {
          title: 'Only Milestone',
          description: 'Single milestone verifiable done',
          priority: 'High',
          durationWeeks: 4,
          deliverables: [{ title: 'D1', description: 'Deliverable one' }],
        },
      ],
    };
    const raw = JSON.stringify(invalid);

    expect(() => agent.parseOutput(raw)).toThrow(AgentParseError);
  });

  it('throws AgentParseError when a milestone has 0 deliverables', () => {
    const agent = makeAgent();
    const invalid = makeValidRoadmapOutput();
    // Set deliverables to empty array on one milestone
    invalid.phases[0].milestones[0] = {
      title: 'M1',
      description: 'Milestone one description verifiable',
      priority: 'High',
      durationWeeks: 2,
      deliverables: [],
    };
    const raw = JSON.stringify(invalid);

    expect(() => agent.parseOutput(raw)).toThrow(AgentParseError);
  });
});

// ─── Property Tests ───────────────────────────────────────────────────────────

/**
 * Feature: innovation-os, Property 7: Roadmap Phase Ordering Invariant
 * Validates: Requirements 5.1
 *
 * For any valid roadmap output with all 6 phases in canonical order and varied
 * but valid timeline values, the parsed output always has exactly 6 phases with
 * names matching canonical order and order values 1–6 sequentially.
 */
describe('Property 7 — Roadmap Phase Ordering Invariant', () => {
  it('parsed output always has exactly 6 phases in canonical order with sequential order values', () => {
    const agent = makeAgent();

    const CANONICAL_NAMES = ['Research', 'Validation', 'MVP', 'Testing', 'Launch', 'Growth'] as const;

    // Arbitrary for a valid milestone
    const milestoneArb = fc.record({
      title: fc.string({ minLength: 1, maxLength: 30 }),
      description: fc.string({ minLength: 1, maxLength: 80 }),
      priority: fc.constantFrom('High' as const, 'Medium' as const, 'Low' as const),
      durationWeeks: fc.integer({ min: 1, max: 8 }),
      deliverables: fc.array(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 30 }),
          description: fc.string({ minLength: 1, maxLength: 80 }),
        }),
        { minLength: 1, maxLength: 4 }
      ),
    });

    // Generate 6 non-overlapping timeline slots for the 6 phases
    // Each phase gets startWeek and endWeek with endWeek > startWeek
    // We generate 6 independent durations (1–6 weeks each) and chain them
    const phaseDurationsArb = fc.array(fc.integer({ min: 1, max: 6 }), {
      minLength: 6,
      maxLength: 6,
    });

    fc.assert(
      fc.property(
        phaseDurationsArb,
        fc.array(fc.array(milestoneArb, { minLength: 2, maxLength: 4 }), {
          minLength: 6,
          maxLength: 6,
        }),
        (durations, milestonesPerPhase) => {
          // Build consecutive timeline
          let currentWeek = 0;
          const phases = CANONICAL_NAMES.map((name, i) => {
            const startWeek = currentWeek;
            const endWeek = currentWeek + durations[i];
            currentWeek = endWeek;
            return {
              name,
              order: i + 1,
              startWeek,
              endWeek,
              milestones: milestonesPerPhase[i],
            };
          });

          const raw = JSON.stringify({ phases });
          const result = agent.parseOutput(raw);

          // Exactly 6 phases
          expect(result.phases).toHaveLength(6);

          // Names match canonical order exactly
          CANONICAL_NAMES.forEach((expectedName, i) => {
            expect(result.phases[i].name).toBe(expectedName);
          });

          // Order values are 1–6 sequentially
          result.phases.forEach((phase, i) => {
            expect(phase.order).toBe(i + 1);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: innovation-os, Property 8: Roadmap Phase Timeline Validity
 * Validates: Requirements 5.4
 *
 * For any valid roadmap output, every phase has startWeek >= 0 and endWeek > startWeek.
 */
describe('Property 8 — Roadmap Phase Timeline Validity', () => {
  it('every parsed phase always has startWeek >= 0 and endWeek > startWeek', () => {
    const agent = makeAgent();

    const CANONICAL_NAMES = ['Research', 'Validation', 'MVP', 'Testing', 'Launch', 'Growth'] as const;

    const milestoneArb = fc.record({
      title: fc.string({ minLength: 1, maxLength: 30 }),
      description: fc.string({ minLength: 1, maxLength: 80 }),
      priority: fc.constantFrom('High' as const, 'Medium' as const, 'Low' as const),
      durationWeeks: fc.integer({ min: 1, max: 8 }),
      deliverables: fc.array(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 30 }),
          description: fc.string({ minLength: 1, maxLength: 80 }),
        }),
        { minLength: 1, maxLength: 4 }
      ),
    });

    // Generate positive durations for each phase and a non-negative starting week
    const startOffsetArb = fc.integer({ min: 0, max: 10 });
    const phaseDurationsArb = fc.array(fc.integer({ min: 1, max: 8 }), {
      minLength: 6,
      maxLength: 6,
    });

    fc.assert(
      fc.property(
        startOffsetArb,
        phaseDurationsArb,
        fc.array(fc.array(milestoneArb, { minLength: 2, maxLength: 4 }), {
          minLength: 6,
          maxLength: 6,
        }),
        (startOffset, durations, milestonesPerPhase) => {
          let currentWeek = startOffset;
          const phases = CANONICAL_NAMES.map((name, i) => {
            const startWeek = currentWeek;
            const endWeek = currentWeek + durations[i];
            currentWeek = endWeek;
            return {
              name,
              order: i + 1,
              startWeek,
              endWeek,
              milestones: milestonesPerPhase[i],
            };
          });

          const raw = JSON.stringify({ phases });
          const result = agent.parseOutput(raw);

          result.phases.forEach((phase) => {
            expect(phase.startWeek).toBeGreaterThanOrEqual(0);
            expect(phase.endWeek).toBeGreaterThan(phase.startWeek);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
