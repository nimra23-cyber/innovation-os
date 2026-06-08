import { z } from 'zod';
import { AgentType, IdeaData } from '@innovationos/shared';
import { BaseAgent, AgentOutput } from './BaseAgent';
import { parseJsonSafe } from './parseJsonSafe';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AgentParseError } from '../lib/errors';
import { computeLaunchReadiness } from '../config/scoringWeights';

// ─── Zod schema for LLM output ───────────────────────────────────────────────

const FeasibilityLLMSchema = z.object({
  technicalScore: z.number().int().min(0).max(100),
  marketScore: z.number().int().min(0).max(100),
  financialScore: z.number().int().min(0).max(100),
  technicalExplanation: z.string().min(40),
  marketExplanation: z.string().min(40),
  financialExplanation: z.string().min(40),
  innovationExplanation: z.string().min(40),
  launchReadinessExplanation: z.string().min(40),
  dataSourceAttribution: z.string().min(1),
});

type FeasibilityLLMOutput = z.infer<typeof FeasibilityLLMSchema>;

// ─── Full output type ─────────────────────────────────────────────────────────

export interface FeasibilityOutput {
  technicalScore: number;
  marketScore: number;
  financialScore: number;
  innovationScore: number;        // from ValidationResult DB
  launchReadinessScore: number;   // computed, not from LLM
  technicalExplanation: string;
  marketExplanation: string;
  financialExplanation: string;
  innovationExplanation: string;
  launchReadinessExplanation: string;
}

// ─── FeasibilityEngine ────────────────────────────────────────────────────────

export class FeasibilityEngine extends BaseAgent<FeasibilityOutput> {
  readonly agentType: AgentType = 'feasibility';

  // ── Private helpers ──────────────────────────────────────────────────────

  private async getInnovationScoreFromDB(): Promise<number> {
    const result = await prisma.validationResult.findUnique({
      where: { projectId: this.projectId },
      select: { innovationScore: true },
    });
    if (!result) {
      throw new Error(`ValidationResult not found for project ${this.projectId}`);
    }
    return result.innovationScore;
  }

  private buildPromptWithContext(idea: IdeaData, innovationScore: number): string {
    return `You are an expert feasibility analyst evaluating a startup idea for student innovators.
Your analysis should be thorough, constructive, and grounded in real-world feasibility considerations.

## Idea to Evaluate

**Title:** ${idea.title}
**Industry:** ${idea.industry}
**Description:** ${idea.description}
**Problem Statement:** ${idea.problemStatement}
**Target Audience:** ${idea.targetAudience}
**Goals:** ${idea.goals}

## Context

The innovation score for this idea has already been determined through prior validation analysis.
**Innovation Score (from validation): ${innovationScore}** — do NOT re-derive this value.

## Your Task

Evaluate the feasibility of this startup idea across three dimensions and respond with a JSON object ONLY — no markdown, no explanation, no code fences.
Use exactly the field names listed below.

### Required JSON fields:

- **technicalScore** (integer 0–100): How technically achievable is this idea given current technology and available resources?
- **marketScore** (integer 0–100): How strong is the market opportunity and how accessible is the target market?
- **financialScore** (integer 0–100): How financially viable is this idea — considering costs, revenue model, and funding potential?
- **technicalExplanation** (string, at least 40 characters): Explain the technical feasibility score with specific observations about implementation complexity, required technologies, and team capability needs.
- **marketExplanation** (string, at least 40 characters): Explain the market feasibility score covering market size, demand signals, and competitive positioning.
- **financialExplanation** (string, at least 40 characters): Explain the financial feasibility score covering cost structure, revenue potential, and path to profitability.
- **innovationExplanation** (string, at least 40 characters): Provide context for the innovation score of ${innovationScore}/100 — explain what makes this idea innovative or where innovation could be strengthened.
- **launchReadinessExplanation** (string, at least 40 characters): Explain the overall launch readiness based on the combined technical, market, financial, and innovation dimensions.
- **dataSourceAttribution** (string): Cite the knowledge sources or reasoning frameworks used for this evaluation.

### Guidelines:
- Frame all feedback constructively — highlight strengths and opportunities
- Use encouraging, educational language appropriate for student innovators
- Provide specific, actionable insights grounded in the idea's context
- Do NOT include an innovationScore or launchReadinessScore field — these are computed separately

Respond with valid JSON only. Do not include any text outside the JSON object.`;
  }

  // ── Abstract method implementations ──────────────────────────────────────

  /**
   * Thin wrapper — buildPromptWithContext is the real implementation.
   * This satisfies the abstract contract but execute() calls buildPromptWithContext directly.
   */
  buildPrompt(idea: IdeaData): string {
    return this.buildPromptWithContext(idea, 0);
  }

  parseLLMOutput(raw: string): FeasibilityLLMOutput {
    const parsed = parseJsonSafe<unknown>(raw, this.agentType);

    const result = FeasibilityLLMSchema.safeParse(parsed);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const fieldPath = firstIssue.path.join('.') || 'unknown field';
      throw new AgentParseError(
        `Feasibility agent output failed schema validation at "${fieldPath}": ${firstIssue.message}`,
        this.agentType,
        raw
      );
    }

    return result.data;
  }

  parseOutput(raw: string): FeasibilityOutput {
    // parseOutput is required by the abstract contract.
    // It cannot produce the full FeasibilityOutput without the DB-sourced innovationScore,
    // so it delegates to parseLLMOutput and fills in placeholder values.
    // The real compose step is done inside execute().
    const llmOutput = this.parseLLMOutput(raw);
    return {
      ...llmOutput,
      innovationScore: 0,       // placeholder — real value injected in execute()
      launchReadinessScore: 0,  // placeholder — computed in execute()
    };
  }

  async persistOutput(projectId: string, output: FeasibilityOutput): Promise<void> {
    await prisma.feasibilityScore.create({
      data: {
        projectId,
        technicalScore: output.technicalScore,
        marketScore: output.marketScore,
        financialScore: output.financialScore,
        innovationScore: output.innovationScore,
        launchReadinessScore: output.launchReadinessScore,
        technicalExplanation: output.technicalExplanation,
        marketExplanation: output.marketExplanation,
        financialExplanation: output.financialExplanation,
        innovationExplanation: output.innovationExplanation,
        launchReadinessExplanation: output.launchReadinessExplanation,
      },
    });
  }

  // ── Override execute() ────────────────────────────────────────────────────

  /**
   * Overrides BaseAgent.execute() to:
   * 1. Fetch innovationScore from the prior ValidationResult in the DB
   * 2. Build a context-aware prompt that includes the innovationScore
   * 3. Parse the LLM response (3 scores + 5 explanations) — with up to 3 retries
   * 4. Compute launchReadinessScore via computeLaunchReadiness()
   * 5. Persist the composite FeasibilityOutput to FeasibilityScore table
   */
  async execute(idea: IdeaData): Promise<AgentOutput<FeasibilityOutput>> {
    logger.info({ agentType: this.agentType, projectId: this.projectId }, 'Agent starting');

    await this.init();

    const innovationScore = await this.getInnovationScoreFromDB();

    const prompt = this.buildPromptWithContext(idea, innovationScore);

    logger.info({ agentType: this.agentType, projectId: this.projectId }, 'Calling LLM');

    const MAX_RETRIES = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      let raw: string;
      try {
        raw = await this.llmClient.complete(this.steeringContext, prompt);
      } catch (llmError) {
        throw llmError; // transport error — no point retrying
      }

      try {
        const llmOutput = this.parseLLMOutput(raw);

        const launchReadinessScore = computeLaunchReadiness(
          llmOutput.technicalScore,
          llmOutput.marketScore,
          llmOutput.financialScore,
          innovationScore
        );

        const output: FeasibilityOutput = {
          ...llmOutput,
          innovationScore,
          launchReadinessScore,
        };

        await this.persistOutput(this.projectId, output);

        logger.info(
          { agentType: this.agentType, projectId: this.projectId, attempt },
          'Agent completed successfully'
        );

        return { agentType: this.agentType, data: output };

      } catch (parseError) {
        lastError = parseError;

        if (parseError instanceof AgentParseError) {
          logger.warn(
            {
              agentType: this.agentType,
              projectId: this.projectId,
              attempt,
              maxAttempts: MAX_RETRIES,
              error: (parseError as Error).message,
            },
            `FeasibilityEngine JSON parse failed on attempt ${attempt} — ${attempt < MAX_RETRIES ? 'retrying' : 'giving up'}`
          );
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 500 * attempt));
            continue;
          }
        } else {
          // Non-parse error (e.g. DB write) — re-throw immediately
          throw parseError;
        }
      }
    }

    throw lastError;
  }
}
