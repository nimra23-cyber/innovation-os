import { z } from 'zod';
import { AgentType, IdeaData } from '@innovationos/shared';
import { BaseAgent } from './BaseAgent';
import { parseJsonSafe } from './parseJsonSafe';
import { prisma } from '../lib/prisma';
import { AgentParseError } from '../lib/errors';

// ─── Zod schema for LLM output ───────────────────────────────────────────────

const CompetitorOutputSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        category: z.enum(['Direct', 'Indirect', 'Substitute']),
        url: z.string().optional(),
      })
    )
    .min(3),
  swot: z.object({
    strengths: z.array(z.string().min(1)).min(2),
    weaknesses: z.array(z.string().min(1)).min(2),
    opportunities: z.array(z.string().min(1)).min(2),
    threats: z.array(z.string().min(1)).min(2),
  }),
  marketOpportunities: z.array(z.string().min(1)).min(2),
  competitiveAdvantages: z.array(z.string().min(1)).min(2),
  dataSourceAttribution: z.string().min(1),
});

export type CompetitorOutput = z.infer<typeof CompetitorOutputSchema>;

// ─── CompetitorAgent ──────────────────────────────────────────────────────────

export class CompetitorAgent extends BaseAgent<CompetitorOutput> {
  readonly agentType: AgentType = 'competitor';

  buildPrompt(idea: IdeaData): string {
    return `You are an expert market research analyst helping student innovators understand the competitive landscape for their startup ideas.
Your analysis should always be constructive, educational, and empowering — written with a student-first mindset.

## Idea to Analyze

**Title:** ${idea.title}
**Industry:** ${idea.industry}
**Description:** ${idea.description}
**Problem Statement:** ${idea.problemStatement}
**Target Audience:** ${idea.targetAudience}
**Goals:** ${idea.goals}

## Your Task

Perform a thorough competitive analysis for this startup idea and respond with a JSON object ONLY — no markdown, no explanation, no code fences.
Use exactly the field names listed below.

### Required JSON fields:

- **competitors** (array of at least 3 objects): Each competitor must have:
  - "name" (string): The name of the competitor or competing product/service
  - "description" (string): A clear description of what this competitor does and why they are relevant
  - "category" (string): Must be exactly one of: "Direct", "Indirect", "Substitute"
    - Direct: Solves the same problem for the same target audience
    - Indirect: Solves the same problem differently or for a different audience
    - Substitute: Provides an alternative way to solve the problem
  - "url" (string, optional): Website URL if publicly known

- **swot** (object): A SWOT analysis of the student's idea relative to competitors. Each quadrant must have at least 2 items:
  - "strengths" (array of at least 2 strings): Internal advantages of the idea over competitors
  - "weaknesses" (array of at least 2 strings): Internal disadvantages or gaps compared to competitors
  - "opportunities" (array of at least 2 strings): External factors the idea can leverage
  - "threats" (array of at least 2 strings): External factors that could hinder success

- **marketOpportunities** (array of at least 2 strings): Specific market gaps or opportunities this idea can capture that competitors have not fully addressed

- **competitiveAdvantages** (array of at least 2 strings): Unique strengths or differentiators that give this idea an edge in the market

- **dataSourceAttribution** (string): Cite the knowledge sources or reasoning frameworks used for this competitive analysis

### Guidelines for student-first analysis:
- Identify real, well-known competitors where possible to give students grounded insights
- Frame weaknesses and threats as learning opportunities, not discouragement
- Highlight genuine advantages to inspire confidence in the student's direction
- Be specific and actionable so the student can use this analysis to refine their strategy
- Use encouraging, educational language appropriate for student innovators

Respond with valid JSON only. Do not include any text outside the JSON object.`;
  }

  parseOutput(raw: string): CompetitorOutput {
    const parsed = parseJsonSafe<unknown>(raw, this.agentType);

    const result = CompetitorOutputSchema.safeParse(parsed);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const fieldPath = firstIssue.path.join('.') || 'unknown field';
      throw new AgentParseError(
        `Competitor agent output failed schema validation at "${fieldPath}": ${firstIssue.message}`,
        this.agentType,
        raw
      );
    }

    return result.data;
  }

  async persistOutput(projectId: string, output: CompetitorOutput): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const analysis = await tx.competitorAnalysis.create({
        data: {
          projectId,
          dataSourceAttribution: output.dataSourceAttribution,
          swotStrengths: JSON.stringify(output.swot.strengths),
          swotWeaknesses: JSON.stringify(output.swot.weaknesses),
          swotOpportunities: JSON.stringify(output.swot.opportunities),
          swotThreats: JSON.stringify(output.swot.threats),
          marketOpportunities: JSON.stringify(output.marketOpportunities),
          competitiveAdvantages: JSON.stringify(output.competitiveAdvantages),
        },
      });

      await tx.competitor.createMany({
        data: output.competitors.map((competitor) => ({
          analysisId: analysis.id,
          name: competitor.name,
          description: competitor.description,
          category: competitor.category,
          url: competitor.url,
        })),
      });
    });
  }
}
