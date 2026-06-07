import { z } from 'zod';
import { AgentType, IdeaData } from '@innovationos/shared';
import { BaseAgent } from './BaseAgent';
import { parseJsonSafe } from './parseJsonSafe';
import { prisma } from '../lib/prisma';
import { AgentParseError } from '../lib/errors';

// ─── Zod schema for LLM output ───────────────────────────────────────────────

const ValidationOutputSchema = z.object({
  innovationScore: z.number().int().min(0).max(100),
  problemClarityScore: z.number().int().min(0).max(100),
  marketDemandScore: z.number().int().min(0).max(100),
  technicalFeasibilityScore: z.number().int().min(0).max(100),
  innovationExplanation: z.string().min(50),
  problemClarityExplanation: z.string().min(50),
  marketDemandExplanation: z.string().min(50),
  techFeasibilityExplanation: z.string().min(50),
  risks: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        severity: z.enum(['High', 'Medium', 'Low']),
      })
    )
    .min(3),
  recommendations: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        impactRank: z.number().int().min(1),
      })
    )
    .min(3),
  dataSourceAttribution: z.string().min(1),
});

export type ValidationOutput = z.infer<typeof ValidationOutputSchema>;

// ─── ValidationAgent ─────────────────────────────────────────────────────────

export class ValidationAgent extends BaseAgent<ValidationOutput> {
  readonly agentType: AgentType = 'validation';

  buildPrompt(idea: IdeaData): string {
    return `You are an expert startup evaluator helping student innovators understand and improve their ideas.
Your feedback should always be constructive, educational, and empowering — written with a student-first mindset.

## Idea to Evaluate

**Title:** ${idea.title}
**Industry:** ${idea.industry}
**Description:** ${idea.description}
**Problem Statement:** ${idea.problemStatement}
**Target Audience:** ${idea.targetAudience}
**Goals:** ${idea.goals}

## Your Task

Evaluate this startup idea and respond with a JSON object ONLY — no markdown, no explanation, no code fences.
Use exactly the field names listed below.

### Required JSON fields:

- **innovationScore** (integer 0–100): How novel and differentiated is this idea?
- **problemClarityScore** (integer 0–100): How clearly defined and specific is the problem being solved?
- **marketDemandScore** (integer 0–100): How strong is the evidence of real market demand?
- **technicalFeasibilityScore** (integer 0–100): How technically achievable is this given current resources?
- **innovationExplanation** (string, at least 50 words): Explain the innovation score with specific observations.
- **problemClarityExplanation** (string, at least 50 words): Explain the problem clarity score with specific observations.
- **marketDemandExplanation** (string, at least 50 words): Explain the market demand score with specific observations.
- **techFeasibilityExplanation** (string, at least 50 words): Explain the technical feasibility score with specific observations.
- **risks** (array of at least 3 objects): Each risk must have:
  - "title" (string): Short name for the risk
  - "description" (string): Detailed description of the risk
  - "severity" (string): Must be exactly one of: "High", "Medium", "Low"
- **recommendations** (array of at least 3 objects): Each recommendation must have:
  - "title" (string): Short name for the recommendation
  - "description" (string): Actionable advice the student can implement
  - "impactRank" (integer ≥ 1): Priority ranking where 1 = highest impact
- **dataSourceAttribution** (string): Cite the knowledge sources or reasoning frameworks used for this evaluation.

### Guidelines for student-first feedback:
- Frame all feedback constructively — highlight strengths before weaknesses
- Use encouraging, educational language appropriate for student innovators
- Provide specific, actionable advice they can act on immediately
- Acknowledge the effort and creativity behind the idea

Respond with valid JSON only. Do not include any text outside the JSON object.`;
  }

  parseOutput(raw: string): ValidationOutput {
    const parsed = parseJsonSafe<unknown>(raw, this.agentType);

    const result = ValidationOutputSchema.safeParse(parsed);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const fieldPath = firstIssue.path.join('.') || 'unknown field';
      throw new AgentParseError(
        `Validation agent output failed schema validation at "${fieldPath}": ${firstIssue.message}`,
        this.agentType,
        raw
      );
    }

    return result.data;
  }

  async persistOutput(projectId: string, output: ValidationOutput): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const validationResult = await tx.validationResult.create({
        data: {
          projectId,
          innovationScore: output.innovationScore,
          problemClarityScore: output.problemClarityScore,
          marketDemandScore: output.marketDemandScore,
          technicalFeasibilityScore: output.technicalFeasibilityScore,
          innovationExplanation: output.innovationExplanation,
          problemClarityExplanation: output.problemClarityExplanation,
          marketDemandExplanation: output.marketDemandExplanation,
          techFeasibilityExplanation: output.techFeasibilityExplanation,
          dataSourceAttribution: output.dataSourceAttribution,
        },
      });

      await tx.validationRisk.createMany({
        data: output.risks.map((risk) => ({
          validationId: validationResult.id,
          title: risk.title,
          description: risk.description,
          severity: risk.severity,
        })),
      });

      await tx.validationRecommendation.createMany({
        data: output.recommendations.map((rec) => ({
          validationId: validationResult.id,
          title: rec.title,
          description: rec.description,
          impactRank: rec.impactRank,
        })),
      });
    });
  }
}
