const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Request failed');
  return json.data ?? json;
}

export interface ProjectSummary {
  id: string;
  title: string;
  industry: string;
  createdAt: string;
  agentStatuses: Record<string, string>;
}

export interface ProjectDetail {
  id: string;
  title: string;
  industry: string;
  description: string;
  problemStatement: string;
  targetAudience: string;
  goals: string;
  createdAt: string;
  agentStatuses: Record<string, string>;
}

export interface AgentOutput {
  id: string;
  projectId: string;
  agentType: string;
  status: string;
  output: Record<string, unknown> | null;
}

export interface ReportData {
  id: string;
  projectId: string;
  executiveSummary: string;
  keyRecommendations: string[];
  generatedAt: string;
  updatedAt: string;
  validation?: Record<string, unknown> | null;
  competitor?: Record<string, unknown> | null;
  roadmap?: Record<string, unknown> | null;
  feasibility?: Record<string, unknown> | null;
}

export const api = {
  createProject: (body: Record<string, string>) =>
    request<ProjectSummary>('/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listProjects: () => request<ProjectSummary[]>('/projects'),

  getProject: (id: string) => request<ProjectDetail>(`/projects/${id}`),

  getAgentOutput: (projectId: string, agentType: string) =>
    request<AgentOutput>(`/projects/${projectId}/agents/${agentType}`),

  retryAgent: (projectId: string, agentType: string) =>
    request<{ accepted: boolean }>(`/projects/${projectId}/agents/${agentType}/retry`, {
      method: 'POST',
    }),

  getReport: (projectId: string) =>
    request<ReportData | null>(`/reports/${projectId}`),

  regenerateReport: (projectId: string) =>
    request<{ accepted: boolean }>(`/reports/${projectId}/regenerate`, { method: 'POST' }),
};
