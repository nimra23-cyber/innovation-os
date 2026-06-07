import type {
  ValidationResultDto,
  CompetitorAnalysisDto,
  RoadmapPhaseDto,
  FeasibilityScoreDto,
} from './agents';

export interface StartupIntelligenceReportDto {
  id: string;
  projectId: string;
  executiveSummary: string;
  keyRecommendations: string[];
  generatedAt: string;
  updatedAt: string;
}

export interface FullReportData {
  report: StartupIntelligenceReportDto;
  projectTitle: string;
  projectIndustry: string;
  projectCreatedAt: string;
  validation: ValidationResultDto;
  competitor: CompetitorAnalysisDto;
  roadmapPhases: RoadmapPhaseDto[];
  feasibility: FeasibilityScoreDto;
}
