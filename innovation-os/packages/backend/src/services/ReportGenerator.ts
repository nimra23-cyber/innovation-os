import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { NotFoundError } from '../lib/errors';
import { LLMClient, llmClient } from './LLMClient';

// ─── FullReportData ───────────────────────────────────────────────────────────

export interface FullReportData {
  project: {
    id: string;
    title: string;
    industry: string;
    description: string;
    problemStatement: string;
    targetAudience: string;
    goals: string;
    createdAt: Date;
  };
  validation: {
    innovationScore: number;
    problemClarityScore: number;
    marketDemandScore: number;
    technicalFeasibilityScore: number;
    innovationExplanation: string;
    problemClarityExplanation: string;
    marketDemandExplanation: string;
    techFeasibilityExplanation: string;
    dataSourceAttribution: string;
    risks: Array<{ id: string; title: string; description: string; severity: string }>;
    recommendations: Array<{ id: string; title: string; description: string; impactRank: number }>;
  };
  competitor: {
    competitors: Array<{ id: string; name: string; description: string; category: string; url?: string | null }>;
    swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
    marketOpportunities: string[];
    competitiveAdvantages: string[];
    dataSourceAttribution: string;
  };
  roadmap: {
    phases: Array<{
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
    }>;
  };
  feasibility: {
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
  };
}

// ─── ReportGenerator ─────────────────────────────────────────────────────────

export class ReportGenerator {
  constructor(private readonly llm: LLMClient = llmClient) {}

  /**
   * Generates (or regenerates) the StartupIntelligenceReport for a project.
   * Fetches all agent outputs, generates executive summary via LLM,
   * then upserts the report record.
   */
  async generate(projectId: string): Promise<{
    id: string;
    projectId: string;
    executiveSummary: string;
    keyRecommendations: string;
    generatedAt: Date;
    updatedAt: Date;
  }> {
    logger.info({ projectId }, 'Generating Startup Intelligence Report');

    const data = await this.getFullReportData(projectId);

    const executiveSummary = await this.generateExecutiveSummary(data);
    const safeExecSummary = this.trimToWordLimit(executiveSummary, 300);

    // Extract key recommendations sorted by impactRank (ascending, 1 = highest)
    const keyRecommendations = data.validation.recommendations
      .slice()
      .sort((a, b) => a.impactRank - b.impactRank)
      .map(r => r.title);

    const report = await prisma.startupIntelligenceReport.upsert({
      where: { projectId },
      create: {
        projectId,
        executiveSummary: safeExecSummary,
        keyRecommendations: JSON.stringify(keyRecommendations),
      },
      update: {
        executiveSummary: safeExecSummary,
        keyRecommendations: JSON.stringify(keyRecommendations),
        updatedAt: new Date(),
      },
    });

    logger.info({ projectId, reportId: report.id }, 'Startup Intelligence Report generated');
    return report;
  }

  /**
   * Fetches all agent outputs for a project and assembles FullReportData.
   * Throws NotFoundError if project or any required agent output is missing.
   */
  async getFullReportData(projectId: string): Promise<FullReportData> {
    const project = await prisma.projectWorkspace.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError(`Project not found: ${projectId}`);

    const validation = await prisma.validationResult.findUnique({
      where: { projectId },
      include: {
        risks: true,
        recommendations: true,
      },
    });
    if (!validation) throw new NotFoundError(`ValidationResult not found for project: ${projectId}`);

    const competitorAnalysis = await prisma.competitorAnalysis.findUnique({
      where: { projectId },
      include: { competitors: true },
    });
    if (!competitorAnalysis) throw new NotFoundError(`CompetitorAnalysis not found for project: ${projectId}`);

    const roadmapPhases = await prisma.roadmapPhase.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      include: {
        milestones: {
          include: { deliverables: true },
        },
      },
    });
    if (!roadmapPhases.length) throw new NotFoundError(`RoadmapPhases not found for project: ${projectId}`);

    const feasibility = await prisma.feasibilityScore.findUnique({ where: { projectId } });
    if (!feasibility) throw new NotFoundError(`FeasibilityScore not found for project: ${projectId}`);

    return {
      project: {
        id: project.id,
        title: project.title,
        industry: project.industry,
        description: project.description,
        problemStatement: project.problemStatement,
        targetAudience: project.targetAudience,
        goals: project.goals,
        createdAt: project.createdAt,
      },
      validation: {
        innovationScore: validation.innovationScore,
        problemClarityScore: validation.problemClarityScore,
        marketDemandScore: validation.marketDemandScore,
        technicalFeasibilityScore: validation.technicalFeasibilityScore,
        innovationExplanation: validation.innovationExplanation,
        problemClarityExplanation: validation.problemClarityExplanation,
        marketDemandExplanation: validation.marketDemandExplanation,
        techFeasibilityExplanation: validation.techFeasibilityExplanation,
        dataSourceAttribution: validation.dataSourceAttribution,
        risks: validation.risks.map(r => ({
          id: r.id,
          title: r.title,
          description: r.description,
          severity: r.severity,
        })),
        recommendations: validation.recommendations.map(r => ({
          id: r.id,
          title: r.title,
          description: r.description,
          impactRank: r.impactRank,
        })),
      },
      competitor: {
        competitors: competitorAnalysis.competitors.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description,
          category: c.category,
          url: c.url,
        })),
        swot: {
          strengths: JSON.parse(competitorAnalysis.swotStrengths),
          weaknesses: JSON.parse(competitorAnalysis.swotWeaknesses),
          opportunities: JSON.parse(competitorAnalysis.swotOpportunities),
          threats: JSON.parse(competitorAnalysis.swotThreats),
        },
        marketOpportunities: JSON.parse(competitorAnalysis.marketOpportunities),
        competitiveAdvantages: JSON.parse(competitorAnalysis.competitiveAdvantages),
        dataSourceAttribution: competitorAnalysis.dataSourceAttribution,
      },
      roadmap: {
        phases: roadmapPhases.map(phase => ({
          id: phase.id,
          name: phase.name,
          order: phase.order,
          startWeek: phase.startWeek,
          endWeek: phase.endWeek,
          milestones: phase.milestones.map(m => ({
            id: m.id,
            title: m.title,
            description: m.description,
            priority: m.priority,
            durationWeeks: m.durationWeeks,
            deliverables: m.deliverables.map(d => ({
              id: d.id,
              title: d.title,
              description: d.description,
            })),
          })),
        })),
      },
      feasibility: {
        technicalScore: feasibility.technicalScore,
        marketScore: feasibility.marketScore,
        financialScore: feasibility.financialScore,
        innovationScore: feasibility.innovationScore,
        launchReadinessScore: feasibility.launchReadinessScore,
        technicalExplanation: feasibility.technicalExplanation,
        marketExplanation: feasibility.marketExplanation,
        financialExplanation: feasibility.financialExplanation,
        innovationExplanation: feasibility.innovationExplanation,
        launchReadinessExplanation: feasibility.launchReadinessExplanation,
      },
    };
  }

  private async generateExecutiveSummary(data: FullReportData): Promise<string> {
    const systemContext = `You are a professional startup analyst writing concise executive summaries for student entrepreneurs.
Write in clear, encouraging language. Be specific but brief. Maximum 300 words.`;

    const userPrompt = `Write an executive summary (maximum 300 words) for this startup idea analysis:

**Project:** ${data.project.title} (${data.project.industry})
**Problem:** ${data.project.problemStatement}
**Description:** ${data.project.description}

**Key Scores:**
- Innovation: ${data.validation.innovationScore}/100
- Problem Clarity: ${data.validation.problemClarityScore}/100
- Market Demand: ${data.validation.marketDemandScore}/100
- Launch Readiness: ${data.feasibility.launchReadinessScore}/100

**Top Competitors:** ${data.competitor.competitors.slice(0, 3).map(c => c.name).join(', ')}
**Key Competitive Advantages:** ${data.competitor.competitiveAdvantages.slice(0, 2).join('; ')}

**Feasibility:** Technical ${data.feasibility.technicalScore}/100, Market ${data.feasibility.marketScore}/100, Financial ${data.feasibility.financialScore}/100

**Top Recommendations:**
${data.validation.recommendations
  .slice()
  .sort((a, b) => a.impactRank - b.impactRank)
  .slice(0, 2)
  .map((r, i) => `${i + 1}. ${r.title}: ${r.description}`)
  .join('\n')}

Write a cohesive executive summary that synthesizes these findings. Do not use headers or bullet points — write in flowing paragraphs.`;

    return await this.llm.completeText(systemContext, userPrompt);
  }

  /**
   * Safety net: trims text to at most maxWords words.
   */
  private trimToWordLimit(text: string, maxWords: number): string {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ');
  }
}

export const reportGenerator = new ReportGenerator();
