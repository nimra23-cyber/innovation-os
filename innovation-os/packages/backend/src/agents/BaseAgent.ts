import { AgentType, IdeaData } from '@innovationos/shared';
import { LLMClient, llmClient } from '../services/LLMClient';
import { SteeringLoader } from '../services/SteeringLoader';
import { logger } from '../lib/logger';

export interface AgentOutput<T = unknown> {
  agentType: AgentType;
  data: T;
}

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
   * Errors from any step propagate up to the AgentOrchestrator.
   */
  async execute(idea: IdeaData): Promise<AgentOutput<TOutput>> {
    logger.info({ agentType: this.agentType, projectId: this.projectId }, 'Agent starting');

    await this.init();

    const prompt = this.buildPrompt(idea);

    logger.info(
      { agentType: this.agentType, projectId: this.projectId },
      'Calling LLM'
    );

    const raw = await this.llmClient.complete(this.steeringContext, prompt);

    const parsed = this.parseOutput(raw);

    await this.persistOutput(this.projectId, parsed);

    logger.info(
      { agentType: this.agentType, projectId: this.projectId },
      'Agent completed successfully'
    );

    return { agentType: this.agentType, data: parsed };
  }
}
