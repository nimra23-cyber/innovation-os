import { AgentParseError } from '../lib/errors';

/**
 * Attempts to parse a raw LLM response string as JSON.
 * Strips markdown code fences if present (some models ignore the JSON-only instruction).
 * Throws AgentParseError on failure.
 */
export function parseJsonSafe<T>(raw: string, agentType: string): T {
  // Strip optional markdown code fences: ```json ... ``` or ``` ... ```
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new AgentParseError(
      `Failed to parse JSON response from ${agentType} agent`,
      agentType,
      raw
    );
  }
}
