import { AgentType, IdeaData } from '@innovationos/shared';
import { LLMClient, llmClient } from '../services/LLMClient';
import { SteeringLoader } from '../services/SteeringLoader';
import { logger } from '../lib/logger';
import { AgentParseError } from '../lib/errors';

export interface AgentOutput<T = unknown> {
  agentType: AgentType;
  data: T;
}

/** Maximum number of LLM+parse attempts before giving up. */
const MAX_PARSE_RETRIES = 3;

export abstract class BaseAgent<TOutput = unknown> {
  protected steeringContext: string = '';
  protected llmClient: LLMClient;
  abstract readonly agentType: AgentType;

  constructor(
    protected readonly projectId: string,
    llm?: LLMClient
  ) {
    this.llmClient = llm ?? llmClient;
  }

  /**
   * Loads steering files and stores the combined context.
   * Called at the start of every execute() call.
   */
  async init(): Promise<void> {
    this.steeringContext = await SteeringLoader.loadAll();
  }

  /**
   * Builds the user-facing LLM prompt for this agent.
   * Receives the full idea data.
   */
  abstract buildPrompt(idea: IdeaData): string;

  /**
   * Parses the raw LLM JSON string into a typed output object.
   * Should throw AgentParseError on invalid/unexpected structure.
   */
  abstract parseOutput(raw: string): TOutput;

  /**
   * Persists the parsed output to the database.
   */
  abstract persistOutput(projectId: string, output: TOutput): Promise<void>;

  /**
   * Main execution method. Orchestrates init → buildPrompt → LLM call →
   * parseOutput → persistOutput. Returns the typed AgentOutput.
   *
   * Retries up to MAX_PARSE_RETRIES times if the LLM returns unparseable JSON.
   * Errors from persistOutput propagate up to the AgentOrchestrator.
   */
  async execute(idea: IdeaData): Promise<AgentOutput<TOutput>> {
    logger.info({ agentType: this.agentType, projectId: this.projectId }, 'Agent starting');

    await this.init();

    const prompt = this.buildPrompt(idea);

    logger.info(
      { agentType: this.agentType, projectId: this.projectId },
      'Calling LLM'
    );

    let lastError: Error | unknown = null;

    for (let attempt = 1; attempt <= MAX_PARSE_RETRIES; attempt++) {
      let raw: string;
      try {
        raw = await this.llmClient.complete(this.steeringContext, prompt);
      } catch (llmError) {
        // LLM transport error — re-throw immediately, no point retrying here
        throw llmError;
      }

      try {
        const parsed = this.parseOutput(raw);

        await this.persistOutput(this.projectId, parsed);

        logger.info(
          { agentType: this.agentType, projectId: this.projectId, attempt },
          'Agent completed successfully'
        );

        return { agentType: this.agentType, data: parsed };

      } catch (parseError) {
        lastError = parseError;

        if (parseError instanceof AgentParseError) {
          logger.warn(
            {
              agentType: this.agentType,
              projectId: this.projectId,
              attempt,
              maxAttempts: MAX_PARSE_RETRIES,
              error: parseError.message,
            },
            `JSON parse/validate failed on attempt ${attempt} — ${attempt < MAX_PARSE_RETRIES ? 'retrying' : 'giving up'}`
          );

          if (attempt < MAX_PARSE_RETRIES) {
            // Small delay before retry to avoid hammering the API
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
