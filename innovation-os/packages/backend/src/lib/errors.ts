export class ValidationError extends Error {
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class AgentParseError extends Error {
  constructor(
    message: string,
    public readonly agentType: string,
    public readonly raw?: string
  ) {
    super(message);
    this.name = 'AgentParseError';
  }
}
