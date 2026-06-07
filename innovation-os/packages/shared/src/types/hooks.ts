export type HookActionType = 'trigger_agent' | 'generate_report';

export interface HookTargetConditions {
  featureFlag?: string;
}

export interface HookAction {
  type: HookActionType;
  target: string | string[];
  parallel?: boolean;
  conditions?: Record<string, HookTargetConditions>;
}

export interface HookConditions {
  featureFlag?: string;
  agentType?: string;
}

export interface HookConfig {
  id: string;
  event: string;
  action: HookAction;
  conditions?: HookConditions;
  enabled: boolean;
}

export interface HookEvent {
  name: string;
  projectId: string;
  payload?: {
    agentType?: string;
    [key: string]: unknown;
  };
}
