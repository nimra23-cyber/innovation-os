import type { AgentType, AgentStatus } from './agents';

export type Industry =
  | 'Technology'
  | 'Healthcare'
  | 'Education'
  | 'Finance'
  | 'E-Commerce'
  | 'SaaS'
  | 'AgriTech'
  | 'CleanTech'
  | 'Media & Entertainment'
  | 'Real Estate'
  | 'Transportation'
  | 'Food & Beverage'
  | 'Social Impact'
  | 'Gaming'
  | 'Other';

export const INDUSTRIES: Industry[] = [
  'Technology',
  'Healthcare',
  'Education',
  'Finance',
  'E-Commerce',
  'SaaS',
  'AgriTech',
  'CleanTech',
  'Media & Entertainment',
  'Real Estate',
  'Transportation',
  'Food & Beverage',
  'Social Impact',
  'Gaming',
  'Other',
];

export interface CreateProjectDto {
  title: string;
  description: string;
  problemStatement: string;
  targetAudience: string;
  industry: Industry;
  goals: string;
}

export interface ProjectWorkspace {
  id: string;
  title: string;
  description: string;
  problemStatement: string;
  targetAudience: string;
  industry: Industry;
  goals: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWorkspaceSummary {
  id: string;
  title: string;
  industry: Industry;
  createdAt: string;
  agentStatuses: Record<AgentType, AgentStatus>;
}

export interface IdeaData {
  id: string;
  title: string;
  description: string;
  problemStatement: string;
  targetAudience: string;
  industry: Industry;
  goals: string;
}
