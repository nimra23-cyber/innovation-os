'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { cn, scoreColor, scoreBg, formatDate } from '@/lib/utils';
import { ScoreCard } from '@/components/ui/ScoreCard';
import { Badge } from '@/components/ui/Badge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely parse keyRecommendations whether it arrives as string[] or a JSON
 * string (e.g. "[\"Rec 1\",\"Rec 2\"]"). Returns [] on any failure.
 */
function parseRecommendations(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((r) => typeof r === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((r: unknown) => typeof r === 'string');
    } catch {
      // malformed — fall through
    }
  }
  return [];
}

// ─── Local types ──────────────────────────────────────────────────────────────

interface Competitor {
  id: string;
  name: string;
  description: string;
  category: string;
  url?: string | null;
}

interface SwotData {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  priority: string;
  durationWeeks: number;
  deliverables: Array<{ id: string; title: string; description: string }>;
}

interface Phase {
  id: string;
  name: string;
  order: number;
  startWeek: number;
  endWeek: number;
  milestones: Milestone[];
}

interface ValidationData {
  innovationScore: number;
  problemClarityScore: number;
  marketDemandScore: number;
  technicalFeasibilityScore: number;
  innovationExplanation: string;
  problemClarityExplanation: string;
  marketDemandExplanation: string;
  techFeasibilityExplanation: string;
}

interface CompetitorData {
  competitors: Competitor[];
  swot: SwotData;
  marketOpportunities: string[];
  competitiveAdvantages: string[];
}

interface FeasibilityData {
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

interface FullReport {
  id: string;
  projectId: string;
  executiveSummary: string;
  keyRecommendations: unknown; // intentionally loose — normalised by parseRecommendations()
  generatedAt: string;
  validation?: ValidationData | null;
  competitor?: CompetitorData | null;
  roadmap?: { phases: Phase[] } | null;
  feasibility?: FeasibilityData | null;
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-foreground border-b border-border pb-2 mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

const categoryVariant = (c: string) =>
  c === 'Direct' ? 'danger' : c === 'Indirect' ? 'warning' : ('info' as const);

const priorityVariant = (p: string) =>
  p === 'High' ? 'danger' : p === 'Medium' ? 'warning' : ('success' as const);

// ─── Main page ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000;

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [report, setReport] = useState<FullReport | null>(null);
  const [pending, setPending] = useState(true); // true = still waiting for report
  const [fetchError, setFetchError] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const tryFetch = async () => {
    try {
      const data = await api.getReport(projectId);
      if (data) {
        setReport(data as unknown as FullReport);
        setPending(false);
        setFetchError(false);
        stopPolling(); // report found — no need to keep polling
      }
      // data === null means still generating — keep polling
    } catch {
      // Network / server error — keep polling, mark as errored only after
      // we stop (i.e. if user leaves the page). Don't stop polling on errors.
      setFetchError(true);
    }
  };

  useEffect(() => {
    // Immediate first attempt
    tryFetch();

    // Then poll every 5 s until the report is loaded
    pollRef.current = setInterval(tryFetch, POLL_INTERVAL_MS);

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Loading / pending state ────────────────────────────────────────────────

  if (pending) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-14 h-14 rounded-full border-2 border-primary/30 border-t-primary animate-spin mx-auto mb-6" />
        <p className="text-lg font-semibold text-foreground mb-2">
          Generating your Startup Intelligence Report…
        </p>
        <p className="text-sm text-muted-foreground">
          This usually takes 30–60 seconds after all agents complete.
          {fetchError && ' (Retrying…)'}
        </p>
        <a
          href={`/projects/${projectId}`}
          className="mt-6 inline-block text-sm text-primary hover:underline"
        >
          ← Back to dashboard
        </a>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-lg font-semibold text-foreground mb-2">Report unavailable</p>
        <a href={`/projects/${projectId}`} className="text-sm text-primary hover:underline">
          ← Back to dashboard
        </a>
      </div>
    );
  }

  const validation = report.validation;
  const competitor = report.competitor;
  const phases = report.roadmap?.phases ?? [];
  const feasibility = report.feasibility;
  const keyRecommendations = parseRecommendations(report.keyRecommendations);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <a
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </a>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-xl">
            📄
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Startup Intelligence Report</h1>
            <p className="text-xs text-muted-foreground">
              Generated {formatDate(report.generatedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <ReportSection title="Executive Summary">
        <div className="p-5 rounded-xl bg-primary/10 border border-primary/30">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
            {report.executiveSummary}
          </p>
        </div>
      </ReportSection>

      {/* Validation Scores */}
      {validation && (
        <ReportSection title="Idea Validation">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <ScoreCard label="Innovation" score={validation.innovationScore} explanation={validation.innovationExplanation} />
            <ScoreCard label="Problem Clarity" score={validation.problemClarityScore} explanation={validation.problemClarityExplanation} />
            <ScoreCard label="Market Demand" score={validation.marketDemandScore} explanation={validation.marketDemandExplanation} />
            <ScoreCard label="Tech Feasibility" score={validation.technicalFeasibilityScore} explanation={validation.techFeasibilityExplanation} />
          </div>
        </ReportSection>
      )}

      {/* Competitor Analysis */}
      {competitor && (
        <ReportSection title="Competitor Analysis">
          {competitor.competitors.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Identified Competitors</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border">
                      <th className="pb-2 pr-4 text-xs font-semibold text-muted-foreground">Name</th>
                      <th className="pb-2 pr-4 text-xs font-semibold text-muted-foreground">Type</th>
                      <th className="pb-2 text-xs font-semibold text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {competitor.competitors.map((comp) => (
                      <tr key={comp.id}>
                        <td className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">{comp.name}</td>
                        <td className="py-3 pr-4">
                          <Badge variant={categoryVariant(comp.category)}>{comp.category}</Badge>
                        </td>
                        <td className="py-3 text-muted-foreground text-xs">{comp.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {competitor.swot && (
            <div className="mb-6">
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
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
                    <ul className="space-y-1">
                      {competitor.swot[key].map((item, i) => (
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

          {(competitor.marketOpportunities.length > 0 || competitor.competitiveAdvantages.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-4">
              {competitor.marketOpportunities.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Market Opportunities</h3>
                  <ul className="space-y-1.5">
                    {competitor.marketOpportunities.map((item, i) => (
                      <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                        <span className="text-blue-400 shrink-0">→</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {competitor.competitiveAdvantages.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Competitive Advantages</h3>
                  <ul className="space-y-1.5">
                    {competitor.competitiveAdvantages.map((item, i) => (
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
        </ReportSection>
      )}

      {/* Roadmap */}
      {phases.length > 0 && (
        <ReportSection title="Startup Roadmap">
          <div className="space-y-4">
            {phases.map((phase) => (
              <div key={phase.id} className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-secondary/30">
                  <span className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {phase.order}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{phase.name}</p>
                    <p className="text-xs text-muted-foreground">Week {phase.startWeek} – {phase.endWeek}</p>
                  </div>
                </div>
                <div className="px-4 pb-4 pt-2 space-y-2">
                  {phase.milestones.map((milestone) => (
                    <div key={milestone.id} className="p-3 rounded-lg bg-secondary/20 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={priorityVariant(milestone.priority)}>{milestone.priority}</Badge>
                        <span className="text-sm font-medium text-foreground">{milestone.title}</span>
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">{milestone.durationWeeks}w</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1.5">{milestone.description}</p>
                      {milestone.deliverables.length > 0 && (
                        <ul className="space-y-0.5">
                          {milestone.deliverables.map((d) => (
                            <li key={d.id} className="text-xs text-muted-foreground flex gap-1.5">
                              <span className="text-primary shrink-0">◦</span>
                              <span><strong className="text-foreground/80">{d.title}:</strong> {d.description}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ReportSection>
      )}

      {/* Feasibility */}
      {feasibility && (
        <ReportSection title="Feasibility Assessment">
          <div className="text-center py-5 bg-secondary/20 rounded-xl border border-border mb-4">
            <p className="text-sm text-muted-foreground mb-1">Launch Readiness Score</p>
            <p className={cn('text-5xl font-bold', scoreColor(feasibility.launchReadinessScore))}>
              {feasibility.launchReadinessScore}
            </p>
            <div className="w-40 mx-auto mt-2 bg-secondary rounded-full h-2.5">
              <div
                className={cn('h-2.5 rounded-full', scoreBg(feasibility.launchReadinessScore))}
                style={{ width: `${feasibility.launchReadinessScore}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
              {feasibility.launchReadinessExplanation}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <ScoreCard label="Technical" score={feasibility.technicalScore} explanation={feasibility.technicalExplanation} />
            <ScoreCard label="Market" score={feasibility.marketScore} explanation={feasibility.marketExplanation} />
            <ScoreCard label="Financial" score={feasibility.financialScore} explanation={feasibility.financialExplanation} />
            <ScoreCard label="Innovation" score={feasibility.innovationScore} explanation={feasibility.innovationExplanation} />
          </div>
        </ReportSection>
      )}

      {/* Key Recommendations */}
      {keyRecommendations.length > 0 && (
        <ReportSection title="Key Recommendations">
          <ol className="space-y-3">
            {keyRecommendations.map((rec, i) => (
              <li key={i} className="flex gap-4 p-4 bg-card border border-border rounded-lg">
                <span className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm text-foreground leading-relaxed">{rec}</p>
              </li>
            ))}
          </ol>
        </ReportSection>
      )}

      {/* AI Disclaimer */}
      <div className="mt-10 p-4 rounded-xl border border-border bg-secondary/20 text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          🤖 <strong>AI-Generated Report:</strong> This analysis was produced by AI agents using
          publicly available data and heuristic modelling. It is intended as a learning tool and
          starting point for further research — not as professional business, legal, or financial
          advice. Always validate findings with domain experts before making strategic decisions.
        </p>
      </div>
    </div>
  );
}
