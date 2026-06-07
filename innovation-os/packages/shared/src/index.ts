// Agents
export type {
  AgentType,
  AgentStatus,
  RoadmapPhaseName,
  CompetitorCategory,
  Severity,
  Priority,
  AgentRunSummary,
  ValidationRisk,
  ValidationRecommendation,
  ValidationResultDto,
  Competitor,
  SwotAnalysis,
  CompetitorAnalysisDto,
  Deliverable,
  Milestone,
  RoadmapPhaseDto,
  FeasibilityScoreDto,
} from './types/agents';

// Project
export type {
  Industry,
  CreateProjectDto,
  ProjectWorkspace,
  ProjectWorkspaceSummary,
  IdeaData,
} from './types/project';
export { INDUSTRIES } from './types/project';

// Report
export type {
  StartupIntelligenceReportDto,
  FullReportData,
} from './types/report';

// API
export type {
  ApiResponse,
  ApiErrorDetail,
  ApiErrorResponse,
  ApiResult,
} from './types/api';
export { isApiError } from './types/api';

// Hooks
export type {
  HookActionType,
  HookTargetConditions,
  HookAction,
  HookConditions,
  HookConfig,
  HookEvent,
} from './types/hooks';
