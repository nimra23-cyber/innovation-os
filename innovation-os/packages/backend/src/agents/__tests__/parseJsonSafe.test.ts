import { parseJsonSafe } from '../parseJsonSafe';
import { AgentParseError } from '../../lib/errors';

describe('parseJsonSafe()', () => {
  it('parses a valid JSON string and returns the object', () => {
    const raw = '{"key":"value","num":42}';
    const result = parseJsonSafe<{ key: string; num: number }>(raw, 'validation');
    expect(result).toEqual({ key: 'value', num: 42 });
  });

  it('strips ```json prefix and ``` suffix before parsing', () => {
    const raw = '```json\n{"score":99}\n```';
    const result = parseJsonSafe<{ score: number }>(raw, 'validation');
    expect(result).toEqual({ score: 99 });
  });

  it('strips ``` prefix and suffix without "json" label', () => {
    const raw = '```\n{"score":50}\n```';
    const result = parseJsonSafe<{ score: number }>(raw, 'competitor');
    expect(result).toEqual({ score: 50 });
  });

  it('throws AgentParseError on invalid JSON', () => {
    const raw = 'this is not json';
    expect(() => parseJsonSafe(raw, 'roadmap')).toThrow(AgentParseError);
  });

  it('throws AgentParseError with the correct agentType field', () => {
    const raw = '{invalid}';
    let caught: AgentParseError | undefined;
    try {
      parseJsonSafe(raw, 'feasibility');
    } catch (e) {
      caught = e as AgentParseError;
    }
    expect(caught).toBeDefined();
    expect(caught!.agentType).toBe('feasibility');
  });

  it('handles JSON with leading and trailing whitespace', () => {
    const raw = '   \n{"trimmed":true}\n   ';
    const result = parseJsonSafe<{ trimmed: boolean }>(raw, 'validation');
    expect(result).toEqual({ trimmed: true });
  });
});
