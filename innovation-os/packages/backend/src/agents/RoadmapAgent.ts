import { z } from 'zod';
import { AgentType, IdeaData } from '@innovationos/shared';
import { BaseAgent } from './BaseAgent';
import { parseJsonSafe } from './parseJsonSafe';
import { prisma } from '../lib/prisma';
import { AgentParseError } from '../lib/errors';

// ─── Zod schema for LLM output ───────────────────────────────────────────────

const ROADMAP_PHASES = ['Research', 'Validation', 'MVP', 'Testing', 'Launch', 'Growth'] as const;

const DeliverableSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

const MilestoneSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['High', 'Medium', 'Low']),
  durationWeeks: z.number().int().min(1),
  deliverables: z.array(DeliverableSchema).min(1),
});

const RoadmapPhaseSchema = z.object({
  name: z.enum(ROADMAP_PHASES),
  order: z.number().int().min(1).max(6),
  startWeek: z.number().int().min(0),
  endWeek: z.number().int().min(1),
  milestones: z.array(MilestoneSchema).min(2),
});

const RoadmapOutputSchema = z
  .object({
    phases: z.array(RoadmapPhaseSchema).length(6),
  })
  .superRefine((data, ctx) => {
    // Enforce canonical ordering: Research=1, Validation=2, MVP=3, Testing=4, Launch=5, Growth=6
    const expectedOrder = ['Research', 'Validation', 'MVP', 'Testing', 'Launch', 'Growth'];
    data.phases.forEach((phase, i) => {
      if (phase.name !== expectedOrder[i]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Phase at index ${i} must be "${expectedOrder[i]}", got "${phase.name}"`,
          path: ['phases', i, 'name'],
        });
      }
      if (phase.order !== i + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Phase at index ${i} must have order ${i + 1}, got ${phase.order}`,
          path: ['phases', i, 'order'],
        });
      }
      if (phase.endWeek <= phase.startWeek) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Phase "${phase.name}" endWeek (${phase.endWeek}) must be greater than startWeek (${phase.startWeek})`,
          path: ['phases', i, 'endWeek'],
        });
      }
    });
  });

export type RoadmapOutput = z.infer<typeof RoadmapOutputSchema>;

// ─── RoadmapAgent ─────────────────────────────────────────────────────────────

export class RoadmapAgent extends BaseAgent<RoadmapOutput> {
  readonly agentType: AgentType = 'roadmap';

  buildPrompt(idea: IdeaData): string {
    return `You are an expert startup strategist helping student innovators plan their product roadmap.
Your roadmap should be realistic, milestone-driven, and structured for a student team executing their idea from scratch.

## Idea to Plan

**Title:** ${idea.title}
**Industry:** ${idea.industry}
**Description:** ${idea.description}
**Problem Statement:** ${idea.problemStatement}
**Target Audience:** ${idea.targetAudience}
**Goals:** ${idea.goals}

## Your Task

Create a detailed 6-phase product roadmap for this startup idea and respond with a JSON object ONLY — no markdown, no explanation, no code fences.

### Required JSON structure:

Return a JSON object with a single key "phases" containing an array of exactly 6 phase objects in canonical order.

The 6 phases MUST appear in this exact order with these exact names and order values:
1. Research (order: 1)
2. Validation (order: 2)
3. MVP (order: 3)
4. Testing (order: 4)
5. Launch (order: 5)
6. Growth (order: 6)

Each phase object must have:
- **name** (string): Exactly one of: "Research", "Validation", "MVP", "Testing", "Launch", "Growth" — in that order
- **order** (integer 1–6): Matches the phase position (Research=1, Validation=2, MVP=3, Testing=4, Launch=5, Growth=6)
- **startWeek** (integer ≥ 0): The week this phase begins (first phase starts at 0)
- **endWeek** (integer > startWeek): The week this phase ends — must be strictly greater than startWeek
- **milestones** (array of at least 2 objects): Each milestone must have:
  - "title" (string): Short name for the milestone
  - "description" (string): Detailed description with verifiable completion criteria — what does "done" look like?
  - "priority" (string): Exactly one of: "High", "Medium", "Low"
  - "durationWeeks" (integer ≥ 1): How many weeks this milestone takes
  - "deliverables" (array of at least 1 object): Each deliverable must have:
    - "title" (string): Short name for the deliverable
    - "description" (string): Clear description of the artifact or outcome

### Phase guidance:
- **Research** (order:1): Market research, user interviews, problem validation, competitive landscape
- **Validation** (order:2): Problem-solution fit testing, prototype feedback, hypothesis validation
- **MVP** (order:3): Core feature development, minimal viable product build, initial tech stack setup
- **Testing** (order:4): User acceptance testing, bug fixing, performance testing, beta program
- **Launch** (order:5): Public launch, marketing campaigns, onboarding flows, go-to-market execution
- **Growth** (order:6): User acquisition, feature expansion, monetization, scale infrastructure

### Important constraints:
- Provide exactly 6 phases in canonical order (Research → Validation → MVP → Testing → Launch → Growth)
- Each phase must have endWeek strictly greater than startWeek
- Each phase must have at least 2 milestones
- Each milestone must have at least 1 deliverable
- Milestone descriptions must contain verifiable completion criteria

Respond with valid JSON only. Do not include any text outside the JSON object.`;
  }

  parseOutput(raw: string): RoadmapOutput {
    const parsed = parseJsonSafe<unknown>(raw, this.agentType);

    const result = RoadmapOutputSchema.safeParse(parsed);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const fieldPath = firstIssue.path.join('.') || 'unknown field';
      throw new AgentParseError(
        `Roadmap agent output failed schema validation at "${fieldPath}": ${firstIssue.message}`,
        this.agentType,
        raw
      );
    }

    return result.data;
  }

  async persistOutput(projectId: string, output: RoadmapOutput): Promise<void> {
    await prisma.$transaction(
      output.phases.map((phase) =>
        prisma.roadmapPhase.create({
          data: {
            projectId,
            name: phase.name,
            order: phase.order,
            startWeek: phase.startWeek,
            endWeek: phase.endWeek,
            milestones: {
              create: phase.milestones.map((m) => ({
                title: m.title,
                description: m.description,
                priority: m.priority,
                durationWeeks: m.durationWeeks,
                deliverables: { create: m.deliverables },
              })),
            },
          },
        })
      )
    );
  }
}
