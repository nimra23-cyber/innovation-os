// Feature flag names as a const union for type safety
export type FeatureFlagName =
  | 'FUNDING_AGENT_ENABLED'
  | 'MENTOR_AGENT_ENABLED'
  | 'PITCH_AGENT_ENABLED'
  | 'AI_ADVISOR_ENABLED'
  | 'AUTH_ENABLED';

const FLAGS: Record<FeatureFlagName, boolean> = {
  FUNDING_AGENT_ENABLED: process.env.FUNDING_AGENT_ENABLED === 'true',
  MENTOR_AGENT_ENABLED: process.env.MENTOR_AGENT_ENABLED === 'true',
  PITCH_AGENT_ENABLED: process.env.PITCH_AGENT_ENABLED === 'true',
  AI_ADVISOR_ENABLED: process.env.AI_ADVISOR_ENABLED === 'true',
  AUTH_ENABLED: process.env.AUTH_ENABLED === 'true',
};

export const featureFlags = {
  isEnabled: (flag: FeatureFlagName): boolean => FLAGS[flag] ?? false,
  getAll: (): Record<FeatureFlagName, boolean> => ({ ...FLAGS }),
};
