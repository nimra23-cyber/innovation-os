// Feature: innovation-os, Property 5: Launch Readiness Score Formula Invariant
// Validates: Requirements 6.5, 15.3

import * as fc from 'fast-check';
import { computeLaunchReadiness } from '../scoringWeights';

const scoreArb = fc.integer({ min: 0, max: 100 });

describe('computeLaunchReadiness', () => {
  // Property 1: Formula correctness
  // For any four integers in [0, 100], the result must equal
  // Math.round(t * 0.25 + m * 0.30 + f * 0.20 + i * 0.25)
  it('matches the weighted formula for all inputs in [0, 100]', () => {
    fc.assert(
      fc.property(scoreArb, scoreArb, scoreArb, scoreArb, (t, m, f, i) => {
        const expected = Math.round(t * 0.25 + m * 0.30 + f * 0.20 + i * 0.25);
        expect(computeLaunchReadiness(t, m, f, i)).toBe(expected);
      }),
      { numRuns: 500 }
    );
  });

  // Property 2: Result is always in [0, 100]
  it('always returns a value in [0, 100]', () => {
    fc.assert(
      fc.property(scoreArb, scoreArb, scoreArb, scoreArb, (t, m, f, i) => {
        const result = computeLaunchReadiness(t, m, f, i);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }),
      { numRuns: 500 }
    );
  });

  // Known values — unit tests for specific expected outputs
  describe('known values', () => {
    it('returns 76 for (80, 70, 60, 90)', () => {
      // 80*0.25 + 70*0.30 + 60*0.20 + 90*0.25 = 20 + 21 + 12 + 22.5 = 75.5 → round → 76
      expect(computeLaunchReadiness(80, 70, 60, 90)).toBe(76);
    });

    it('returns 0 for (0, 0, 0, 0)', () => {
      expect(computeLaunchReadiness(0, 0, 0, 0)).toBe(0);
    });

    it('returns 100 for (100, 100, 100, 100)', () => {
      expect(computeLaunchReadiness(100, 100, 100, 100)).toBe(100);
    });
  });
});
