'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/store/projectStore';
import { useSSE } from '@/hooks/useSSE';
import { api } from '@/lib/api';
import { cn, scoreColor, scoreBg, formatDate } from '@/lib/utils';
import { ScoreCard } from '@/components/ui/ScoreCard';
import { Badge } from '@/components/ui/Badge';
import { AgentStatusBadge } from '@/components/ui/AgentStatusBadge';
import type { AgentStatus, AgentType } from '@innovationos/shared';

// ─── Types for agent outputs ──────────────────────────────────────────────────

type CoreAgentType = 'validation' | 'competitor' | 'roadmap' | 'feasibility';

interface AgentOutputMap {
  validation?: Record<string, unknown> | null;
  competitor?: Record<string, unknown> | null;
  roadmap?: Record<string, unknown> | null;
  feasibility?: Record<string, unknown> | null;
}

interface ProjectDetail {
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

interface ReportData {
  id: string;
  executiveSummary: string;
  keyRecommendations: string[];
  generatedAt: string;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

const PIPELINE_STEPS: { key: AgentType | 'report'; label: string; icon: string }[] = [
  { key: 'validation', label: 'Validation', icon: '🔍' },
  { key: 'competitor', label: 'Competitors', icon: '🏆' },
  { key: 'roadmap', label: 'Roadmap', icon: '🗺️' },
  { key: 'feasibility', label: 'Feasibility', icon: '📊' },
  { key: 'report', label: 'Report', icon: '📄' },
];

function PipelineStepper({
  statuses,
  reportReady,
}: {
  statuses: Partial<Record<AgentType, AgentStatus>>;
  reportReady: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between overflow-x-auto gap-2">
        {PIPELINE_STEPS.map((step, i) => {
          const isReport = step.key === 'report';
          const status = isReport
            ? reportReady
              ? 'completed'
              : 'pending'
            : (statuses[step.key as AgentType] ?? 'pending');

          const isCompleted = status === 'completed';
          const isRunning = status === 'running';
          const isFailed = status === 'failed';

          return (
            <div key={step.key} className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all',
                    isCompleted && 'border-green-500 bg-green-500/10',
                    isRunning && 'border-blue-400 bg-blue-400/10 animate-pulse',
                    isFailed && 'border-red-500 bg-red-500/10',
                    !isCompleted && !isRunning && !isFailed && 'border-border bg-secondary/30'
                  )}
                >
                  {isCompleted ? '✅' : isFailed ? '❌' : step.icon}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium hidden sm:block',
                    isCompleted && 'text-green-400',
                    isRunning && 'text-blue-400',
                    isFailed && 'text-red-400',
                    !isCompleted && !isRunning && !isFailed && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-1 rounded-full transition-all hidden sm:block',
                    isCompleted ? 'bg-green-500/50' : 'bg-border'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-border rounded-xl mb-4 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        </div>
        <svg
          className={cn('w-5 h-5 text-muted-foreground transition-transform', open && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

// ─── Validation section ───────────────────────────────────────────────────────

function ValidationSection({ output }: { output: Record<string, unknown> }) {
  const risks = (output.risks as Array<{ id: string; title: string; description: string; severity: string }>) ?? [];
  const recommendations = (output.recommendations as Array<{ id: string; title: string; description: string; impactRank: number }>) ?? [];
  const sorted = [...recommendations].sort((a, b) => a.impactRank - b.impactRank);

  const severityVariant = (s: string) =>
    s === 'High' ? 'danger' : s === 'Medium' ? 'warning' : 'success';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <ScoreCard
          label="Innovation"
          score={output.innovationScore as number}
          explanation={output.innovationExplanation as string}
        />
        <ScoreCard
          label="Problem Clarity"
          score={output.problemClarityScore as number}
          explanation={output.problemClarityExplanation as string}
        />
        <ScoreCard
          label="Market Demand"
          score={output.marketDemandScore as number}
          explanation={output.marketDemandExplanation as string}
        />
        <ScoreCard
          label="Tech Feasibility"
          score={output.technicalFeasibilityScore as number}
          explanation={output.techFeasibilityExplanation as string}
        />
      </div>

      {risks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Identified Risks</h3>
          <div className="space-y-2">
            {risks.map((risk) => (
              <div
                key={risk.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border"
              >
                <Badge variant={severityVariant(risk.severity)} className="shrink-0 mt-0.5">
                  {risk.severity}
                </Badge>
                <div>
                  <p className="text-sm font-medium text-foreground">{risk.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{risk.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Recommendations</h3>
          <div className="space-y-2">
            {sorted.map((rec, i) => (
              <div
                key={rec.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border"
              >
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{rec.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Competitor section ───────────────────────────────────────────────────────

function CompetitorSection({ output }: { output: Record<string, unknown> }) {
  const competitors = (output.competitors as Array<{ id: string; name: string; description: string; category: string; url?: string }>) ?? [];
  const swot = output.swot as { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] } | undefined;
  const marketOpportunities = (output.marketOpportunities as string[]) ?? [];
  const advantages = (output.competitiveAdvantages as string[]) ?? [];

  const categoryVariant = (c: string) =>
    c === 'Direct' ? 'danger' : c === 'Indirect' ? 'warning' : 'info';

  return (
    <div className="space-y-6">
      {competitors.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Competitors</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {competitors.map((comp) => (
              <div
                key={comp.id}
                className="p-4 rounded-lg bg-secondary/30 border border-border"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-semibold text-sm text-foreground">{comp.name}</span>
                  <Badge variant={categoryVariant(comp.category)}>{comp.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {comp.description}
                </p>
                {comp.url && (
                  <a
                    href={comp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-xs text-primary hover:underline block truncate"
                  >
                    {comp.url}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {swot && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">SWOT Analysis</h3>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { key: 'strengths', label: 'Strengths', color: 'border-green-500/40 bg-green-500/5' },
                { key: 'weaknesses', label: 'Weaknesses', color: 'border-red-500/40 bg-red-500/5' },
                { key: 'opportunities', label: 'Opportunities', color: 'border-blue-500/40 bg-blue-500/5' },
                { key: 'threats', label: 'Threats', color: 'border-amber-500/40 bg-amber-500/5' },
              ] as const
            ).map(({ key, label, color }) => (
              <div key={key} className={cn('p-3 rounded-lg border', color)}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {label}
                </p>
                <ul className="space-y-1">
                  {swot[key].map((item, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-1.5">
                      <span className="shrink-0 mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {(marketOpportunities.length > 0 || advantages.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {marketOpportunities.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Market Opportunities</h3>
              <ul className="space-y-1.5">
                {marketOpportunities.map((item, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="text-blue-400 shrink-0">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {advantages.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Competitive Advantages</h3>
              <ul className="space-y-1.5">
                {advantages.map((item, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="text-green-400 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Roadmap section ──────────────────────────────────────────────────────────

function RoadmapSection({ output }: { output: Record<string, unknown> }) {
  const phases = (output.phases as Array<{
    id: string;
    name: string;
    order: number;
    startWeek: number;
    endWeek: number;
    milestones: Array<{
      id: string;
      title: string;
      description: string;
      priority: string;
      durationWeeks: number;
      deliverables: Array<{ id: string; title: string; description: string }>;
    }>;
  }>) ?? [];

  const [openPhase, setOpenPhase] = useState<string | null>(phases[0]?.id ?? null);

  const priorityVariant = (p: string) =>
    p === 'High' ? 'danger' : p === 'Medium' ? 'warning' : 'success';

  return (
    <div className="space-y-3">
      {phases.map((phase) => (
        <div key={phase.id} className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setOpenPhase(openPhase === phase.id ? null : phase.id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-secondary/20 hover:bg-secondary/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                {phase.order}
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">{phase.name}</p>
                <p className="text-xs text-muted-foreground">
                  Week {phase.startWeek} – {phase.endWeek}
                </p>
              </div>
            </div>
            <svg
              className={cn(
                'w-4 h-4 text-muted-foreground transition-transform',
                openPhase === phase.id && 'rotate-180'
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {openPhase === phase.id && (
            <div className="px-4 pb-4 pt-2 space-y-3">
              {phase.milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="p-3 rounded-lg bg-secondary/20 border border-border"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={priorityVariant(milestone.priority)}>
                      {milestone.priority}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">{milestone.title}</span>
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                      {milestone.durationWeeks}w
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{milestone.description}</p>
                  {milestone.deliverables.length > 0 && (
                    <ul className="space-y-1">
                      {milestone.deliverables.map((d) => (
                        <li key={d.id} className="text-xs text-muted-foreground flex gap-1.5">
                          <span className="text-primary shrink-0">◦</span>
                          <span>
                            <strong className="text-foreground/80">{d.title}:</strong> {d.description}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Feasibility section ──────────────────────────────────────────────────────

function FeasibilitySection({ output }: { output: Record<string, unknown> }) {
  const launch = output.launchReadinessScore as number;
  return (
    <div className="space-y-6">
      {/* Hero metric */}
      <div className="text-center py-6 bg-secondary/20 rounded-xl border border-border">
        <p className="text-sm text-muted-foreground mb-2">Launch Readiness Score</p>
        <p className={cn('text-6xl font-bold', scoreColor(launch))}>{launch}</p>
        <div className="w-48 mx-auto mt-3 bg-secondary rounded-full h-3">
          <div
            className={cn('h-3 rounded-full transition-all', scoreBg(launch))}
            style={{ width: `${launch}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-3 max-w-xs mx-auto">
          {output.launchReadinessExplanation as string}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <ScoreCard
          label="Technical"
          score={output.technicalScore as number}
          explanation={output.technicalExplanation as string}
        />
        <ScoreCard
          label="Market"
          score={output.marketScore as number}
          explanation={output.marketExplanation as string}
        />
        <ScoreCard
          label="Financial"
          score={output.financialScore as number}
          explanation={output.financialExplanation as string}
        />
        <ScoreCard
          label="Innovation"
          score={output.innovationScore as number}
          explanation={output.innovationExplanation as string}
        />
      </div>
    </div>
  );
}

// ─── Report teaser ────────────────────────────────────────────────────────────

function ReportSection({
  report,
  projectId,
}: {
  report: ReportData;
  projectId: string;
}) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
          Executive Summary
        </p>
        <p className="text-sm text-foreground leading-relaxed">{report.executiveSummary}</p>
      </div>

      {report.keyRecommendations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Key Recommendations</h3>
          <ol className="space-y-1.5">
            {report.keyRecommendations.map((rec, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                {rec}
              </li>
            ))}
          </ol>
        </div>
      )}

      <a
        href={`/projects/${projectId}/report`}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        View Full Report
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

// ─── Loading placeholder ──────────────────────────────────────────────────────

function AgentPending({ agentLabel }: { agentLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin mb-4" />
      <p className="text-sm text-muted-foreground">{agentLabel} agent is working…</p>
      <p className="text-xs text-muted-foreground/60 mt-1">This usually takes under a minute.</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectDashboard() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const { agentStatuses, reportReady, updateAgentStatus } = useProjectStore();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [outputs, setOutputs] = useState<AgentOutputMap>({});
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to SSE
  useSSE(projectId);

  // Load project on mount
  useEffect(() => {
    api.getProject(projectId).then((p) => {
      setProject(p);
      // Seed store with persisted statuses
      Object.entries(p.agentStatuses).forEach(([type, status]) => {
        updateAgentStatus(type as AgentType, status as AgentStatus);
      });
      setLoading(false);
    }).catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Fetch completed agent outputs
  const fetchOutput = useCallback(
    async (agentType: CoreAgentType) => {
      try {
        const data = await api.getAgentOutput(projectId, agentType);
        if (data.status === 'completed' && data.output) {
          setOutputs((prev) => ({ ...prev, [agentType]: data.output }));
        }
      } catch {
        // silently ignore
      }
    },
    [projectId]
  );

  // Fetch report
  const fetchReport = useCallback(async () => {
    try {
      const data = await api.getReport(projectId);
      if (data) setReport(data);
    } catch {
      // silently ignore
    }
  }, [projectId]);

  // Poll for outputs of running/pending agents; stop when all done
  useEffect(() => {
    const AGENTS: CoreAgentType[] = ['validation', 'competitor', 'roadmap', 'feasibility'];

    // Initial fetch for already-completed agents
    AGENTS.forEach((a) => {
      if ((agentStatuses[a] ?? 'pending') === 'completed' && !outputs[a]) {
        fetchOutput(a);
      }
    });

    const timer = setInterval(() => {
      AGENTS.forEach((a) => {
        const status = agentStatuses[a] ?? 'pending';
        if (status === 'completed' && !outputs[a]) {
          fetchOutput(a);
        }
      });

      if (reportReady && !report) {
        fetchReport();
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [agentStatuses, outputs, reportReady, report, fetchOutput, fetchReport]);

  // Fetch report when reportReady becomes true
  useEffect(() => {
    if (reportReady && !report) {
      fetchReport();
    }
  }, [reportReady, report, fetchReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-lg font-semibold text-foreground mb-2">Project not found</p>
        <a href="/projects" className="text-sm text-primary hover:underline">
          ← Back to projects
        </a>
      </div>
    );
  }

  const getStatus = (a: AgentType): AgentStatus =>
    (agentStatuses[a] ?? 'pending') as AgentStatus;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <a href="/projects" className="hover:text-foreground transition-colors">
            Projects
          </a>
          <span>/</span>
          <span className="text-foreground">{project.title}</span>
        </div>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="info">{project.industry}</Badge>
              <span className="text-xs text-muted-foreground">
                Created {formatDate(project.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline stepper */}
      <PipelineStepper statuses={agentStatuses} reportReady={reportReady} />

      {/* Agent sections */}

      {/* Validation */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🔍</span>
          <h2 className="text-base font-semibold text-foreground">Idea Validation</h2>
          <AgentStatusBadge status={getStatus('validation')} />
        </div>
        {getStatus('validation') === 'completed' && outputs.validation ? (
          <Section title="Validation Results" icon="🔍" defaultOpen>
            <ValidationSection output={outputs.validation} />
          </Section>
        ) : getStatus('validation') === 'running' ? (
          <div className="bg-card border border-border rounded-xl">
            <AgentPending agentLabel="Validation" />
          </div>
        ) : getStatus('validation') === 'failed' ? (
          <div className="bg-card border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-sm text-red-400 mb-3">Validation agent failed.</p>
            <RetryButton projectId={projectId} agentType="validation" />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            Waiting to start…
          </div>
        )}
      </div>

      {/* Competitor */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🏆</span>
          <h2 className="text-base font-semibold text-foreground">Competitor Analysis</h2>
          <AgentStatusBadge status={getStatus('competitor')} />
        </div>
        {getStatus('competitor') === 'completed' && outputs.competitor ? (
          <Section title="Competitor Analysis" icon="🏆" defaultOpen>
            <CompetitorSection output={outputs.competitor} />
          </Section>
        ) : getStatus('competitor') === 'running' ? (
          <div className="bg-card border border-border rounded-xl">
            <AgentPending agentLabel="Competitor" />
          </div>
        ) : getStatus('competitor') === 'failed' ? (
          <div className="bg-card border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-sm text-red-400 mb-3">Competitor agent failed.</p>
            <RetryButton projectId={projectId} agentType="competitor" />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            Waiting to start…
          </div>
        )}
      </div>

      {/* Roadmap */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🗺️</span>
          <h2 className="text-base font-semibold text-foreground">Startup Roadmap</h2>
          <AgentStatusBadge status={getStatus('roadmap')} />
        </div>
        {getStatus('roadmap') === 'completed' && outputs.roadmap ? (
          <Section title="Roadmap" icon="🗺️" defaultOpen>
            <RoadmapSection output={outputs.roadmap} />
          </Section>
        ) : getStatus('roadmap') === 'running' ? (
          <div className="bg-card border border-border rounded-xl">
            <AgentPending agentLabel="Roadmap" />
          </div>
        ) : getStatus('roadmap') === 'failed' ? (
          <div className="bg-card border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-sm text-red-400 mb-3">Roadmap agent failed.</p>
            <RetryButton projectId={projectId} agentType="roadmap" />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            Waiting to start…
          </div>
        )}
      </div>

      {/* Feasibility */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">📊</span>
          <h2 className="text-base font-semibold text-foreground">Feasibility Assessment</h2>
          <AgentStatusBadge status={getStatus('feasibility')} />
        </div>
        {getStatus('feasibility') === 'completed' && outputs.feasibility ? (
          <Section title="Feasibility Assessment" icon="📊" defaultOpen>
            <FeasibilitySection output={outputs.feasibility} />
          </Section>
        ) : getStatus('feasibility') === 'running' ? (
          <div className="bg-card border border-border rounded-xl">
            <AgentPending agentLabel="Feasibility" />
          </div>
        ) : getStatus('feasibility') === 'failed' ? (
          <div className="bg-card border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-sm text-red-400 mb-3">Feasibility agent failed.</p>
            <RetryButton projectId={projectId} agentType="feasibility" />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            Waiting to start…
          </div>
        )}
      </div>

      {/* Report */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">📄</span>
          <h2 className="text-base font-semibold text-foreground">Intelligence Report</h2>
          {reportReady ? (
            <Badge variant="success">Ready</Badge>
          ) : (
            <Badge variant="pending">Pending</Badge>
          )}
        </div>
        {reportReady && report ? (
          <Section title="Startup Intelligence Report" icon="📄" defaultOpen>
            <ReportSection report={report} projectId={projectId} />
          </Section>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            {reportReady ? 'Loading report…' : 'Report will be generated after all agents complete.'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Retry button ─────────────────────────────────────────────────────────────

function RetryButton({ projectId, agentType }: { projectId: string; agentType: AgentType }) {
  const [retrying, setRetrying] = useState(false);
  const { updateAgentStatus } = useProjectStore();

  async function handleRetry() {
    setRetrying(true);
    try {
      await api.retryAgent(projectId, agentType);
      updateAgentStatus(agentType, 'running');
    } catch {
      // ignore
    } finally {
      setRetrying(false);
    }
  }

  return (
    <button
      onClick={handleRetry}
      disabled={retrying}
      className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-60"
    >
      {retrying ? 'Retrying…' : 'Retry Agent'}
    </button>
  );
}
