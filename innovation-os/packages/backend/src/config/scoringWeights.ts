export const SCORING_WEIGHTS = {
  technical: 0.25,
  market: 0.30,
  financial: 0.20,
  innovation: 0.25,
} as const;

/**
 * Computes the Launch Readiness Score as a weighted composite.
 * Formula: round(technical × 0.25 + market × 0.30 + financial × 0.20 + innovation × 0.25)
 * All inputs must be integers in [0, 100]. Result is clamped to [0, 100].
 */
export function computeLaunchReadiness(
  technicalScore: number,
  marketScore: number,
  financialScore: number,
  innovationScore: number
): number {
  const raw =
    technicalScore * SCORING_WEIGHTS.technical +
    marketScore * SCORING_WEIGHTS.market +
    financialScore * SCORING_WEIGHTS.financial +
    innovationScore * SCORING_WEIGHTS.innovation;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
