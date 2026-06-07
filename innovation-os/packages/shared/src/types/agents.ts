export type AgentType =
  | 'validation'
  | 'competitor'
  | 'roadmap'
  | 'feasibility'
  | 'funding'
  | 'mentor'
  | 'pitch';

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed';

export type RoadmapPhaseName =
  | 'Research'
  | 'Validation'
  | 'MVP'
  | 'Testing'
  | 'Launch'
  | 'Growth';

export type CompetitorCategory = 'Direct' | 'Indirect' | 'Substitute';

export type Severity = 'High' | 'Medium' | 'Low';

export type Priority = 'High' | 'Medium' | 'Low';

export interface AgentRunSummary {
  id: string;
  agentType: AgentType;
  status: AgentStatus;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ValidationRisk {
  id: string;
  title: string;
  description: string;
  severity: Severity;
}

export interface ValidationRecommendation {
  id: string;
  title: string;
  description: string;
  impactRank: number;
}

export interface ValidationResultDto {
  id: string;
  projectId: string;
  innovationScore: number;
  problemClarityScore: number;
  marketDemandScore: number;
  technicalFeasibilityScore: number;
  innovationExplanation: string;
  problemClarityExplanation: string;
  marketDemandExplanation: string;
  techFeasibilityExplanation: string;
  dataSourceAttribution: string;
  risks: ValidationRisk[];
  recommendations: ValidationRecommendation[];
}

export interface Competitor {
  id: string;
  name: string;
  description: string;
  category: CompetitorCategory;
  url?: string;
}

export interface SwotAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface CompetitorAnalysisDto {
  id: string;
  projectId: string;
  competitors: Competitor[];
  swot: SwotAnalysis;
  marketOpportunities: string[];
  competitiveAdvantages: string[];
  dataSourceAttribution: string;
}

export interface Deliverable {
  id: string;
  title: string;
  description: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  durationWeeks: number;
  deliverables: Deliverable[];
}

export interface RoadmapPhaseDto {
  id: string;
  name: RoadmapPhaseName;
  order: number;
  startWeek: number;
  endWeek: number;
  milestones: Milestone[];
}

export interface FeasibilityScoreDto {
  id: string;
  projectId: string;
  technicalScore: number;
  marketScore: number;
  financialScore: number;
  innovationScore: number;
  launchReadinessScore: number;
  technicalExplanation: string;
  marketExplanation: string;
  financialExplanation: string;
  innovationExplanation: string;
  launchReadinessExplanation: string;
}
