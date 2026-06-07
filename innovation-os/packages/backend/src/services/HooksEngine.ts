import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../lib/logger';
import { featureFlags, FeatureFlagName } from '../config/featureFlags';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HookConditions {
  agentType?: string;
  featureFlag?: string;
}

export interface HookActionPerTargetConditions {
  [target: string]: { featureFlag?: string };
}

export interface HookAction {
  type: 'trigger_agent' | 'generate_report';
  target: string | string[];
  parallel?: boolean;
  conditions?: HookActionPerTargetConditions;
}

export interface HookConfig {
  id: string;
  event: string;
  conditions?: HookConditions;
  action: HookAction;
  enabled: boolean;
}

export interface HookEvent {
  name: string;
  projectId: string;
  payload?: Record<string, unknown>;
}

// Forward declarations to avoid circular imports
type OrchestratorInterface = { runAgent(projectId: string, agentType: string): Promise<void> };
type ReportGeneratorInterface = { generate(projectId: string): Promise<unknown> };

// ─── HooksEngine ──────────────────────────────────────────────────────────────

export class HooksEngine {
  private hooks: HookConfig[] = [];
  private orchestrator: OrchestratorInterface | null = null;
  private reportGenerator: ReportGeneratorInterface | null = null;

  setOrchestrator(orchestrator: OrchestratorInterface): void {
    this.orchestrator = orchestrator;
  }

  setReportGenerator(reportGenerator: ReportGeneratorInterface): void {
    this.reportGenerator = reportGenerator;
  }

  async loadHooks(hooksDir?: string): Promise<void> {
    const dir = hooksDir ?? path.resolve(process.cwd(), '../../../.kiro/hooks');

    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch (err) {
      logger.warn({ dir, err }, 'Could not read hooks directory — running without hooks');
      return;
    }

    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const loaded: HookConfig[] = [];

    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(dir, file), 'utf-8');
        const config = JSON.parse(content) as Partial<HookConfig>;

        // Validate required fields
        if (
          typeof config.id !== 'string' ||
          typeof config.event !== 'string' ||
          typeof config.enabled !== 'boolean' ||
          !config.action ||
          typeof config.action.type !== 'string' ||
          config.action.target === undefined
        ) {
          logger.error({ file }, `Hook config "${file}" is missing required fields — skipping`);
          continue;
        }

        if (config.enabled) {
          loaded.push(config as HookConfig);
          logger.info({ hookId: config.id }, 'Hook loaded');
        }
      } catch (err) {
        logger.error({ file, err }, `Failed to parse hook config "${file}" — skipping`);
      }
    }

    this.hooks = loaded;
    logger.info({ count: loaded.length }, 'Hooks loaded successfully');
  }

  async dispatch(event: HookEvent): Promise<void> {
    const matching = this.hooks.filter(h =>
      h.event === event.name && this.evaluateConditions(h.conditions, event)
    );

    for (const hook of matching) {
      try {
        await this.executeHookAction(hook, event);
      } catch (err) {
        logger.error({ hookId: hook.id, event: event.name, err }, 'Hook execution failed');
        throw err;
      }
    }
  }

  private evaluateConditions(conditions: HookConditions | undefined, event: HookEvent): boolean {
    if (!conditions) return true;

    if (conditions.featureFlag) {
      return featureFlags.isEnabled(conditions.featureFlag as FeatureFlagName);
    }

    if (conditions.agentType) {
      return event.payload?.agentType === conditions.agentType;
    }

    return true;
  }

  private async executeHookAction(hook: HookConfig, event: HookEvent): Promise<void> {
    const { action } = hook;

    if (action.type === 'trigger_agent') {
      if (!this.orchestrator) {
        throw new Error('HooksEngine: orchestrator not set');
      }

      const targets = Array.isArray(action.target) ? action.target : [action.target];

      // For each target, check per-target feature flag conditions
      const eligibleTargets = targets.filter(target => {
        const perTargetCondition = action.conditions?.[target];
        if (perTargetCondition?.featureFlag) {
          return featureFlags.isEnabled(perTargetCondition.featureFlag as FeatureFlagName);
        }
        return true;
      });

      if (action.parallel && eligibleTargets.length > 1) {
        await Promise.all(
          eligibleTargets.map(target => this.orchestrator!.runAgent(event.projectId, target))
        );
      } else {
        for (const target of eligibleTargets) {
          await this.orchestrator.runAgent(event.projectId, target);
        }
      }
    } else if (action.type === 'generate_report') {
      if (!this.reportGenerator) {
        throw new Error('HooksEngine: reportGenerator not set');
      }
      await this.reportGenerator.generate(event.projectId);
    }
  }
}

export const hooksEngine = new HooksEngine();
