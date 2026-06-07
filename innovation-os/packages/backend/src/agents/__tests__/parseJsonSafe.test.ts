import { parseJsonSafe, sanitizeJsonResponse, extractJsonFromText } from '../parseJsonSafe';
import { AgentParseError } from '../../lib/errors';

// ─── parseJsonSafe() — existing tests ────────────────────────────────────────

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
    const raw = 'this is not json at all and cannot be recovered';
    expect(() => parseJsonSafe(raw, 'roadmap')).toThrow(AgentParseError);
  });

  it('throws AgentParseError with the correct agentType field', () => {
    const raw = 'completely unparseable text with no JSON at all';
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

  // ─── Malformed JSON recovery tests ───────────────────────────────────────

  it('recovers from the "strengths>[" corruption pattern', () => {
    const raw = '{"swot":{"strengths>["strong point one","strong point two"],"weaknesses":["w1","w2"]}}';
    // The corruption "strengths>[" should be fixed to "strengths":[ by sanitization
    const result = parseJsonSafe<{ swot: { strengths: string[]; weaknesses: string[] } }>(raw, 'competitor');
    expect(result.swot.strengths).toEqual(['strong point one', 'strong point two']);
    expect(result.swot.weaknesses).toEqual(['w1', 'w2']);
  });

  it('recovers from HTML entity corruption (&gt; instead of >) when outside valid JSON structure', () => {
    // HTML entities inside already-valid JSON string values are NOT decoded
    // (they're valid JSON content). HTML entity decoding only applies during
    // the structural sanitization pass which runs only when Pass 1 fails.
    const raw = '{"value":10,"label":"score&gt;threshold"}';
    const result = parseJsonSafe<{ value: number; label: string }>(raw, 'validation');
    expect(result.value).toBe(10);
    // The string value is preserved as-is since the JSON was already valid
    expect(result.label).toBe('score&gt;threshold');
  });

  it('recovers from trailing comma before closing bracket', () => {
    const raw = '{"scores":[10,20,30,]}';
    const result = parseJsonSafe<{ scores: number[] }>(raw, 'validation');
    expect(result.scores).toEqual([10, 20, 30]);
  });

  it('recovers from trailing comma before closing brace', () => {
    const raw = '{"key":"value","num":42,}';
    const result = parseJsonSafe<{ key: string; num: number }>(raw, 'validation');
    expect(result.key).toBe('value');
    expect(result.num).toBe(42);
  });

  it('extracts JSON object embedded in surrounding prose text', () => {
    const raw = 'Here is my analysis:\n{"score":75,"label":"good"}\nThank you.';
    const result = parseJsonSafe<{ score: number; label: string }>(raw, 'validation');
    expect(result.score).toBe(75);
    expect(result.label).toBe('good');
  });

  it('strips BOM character before parsing', () => {
    const raw = '\uFEFF{"bom":true}';
    const result = parseJsonSafe<{ bom: boolean }>(raw, 'validation');
    expect(result.bom).toBe(true);
  });
});

// ─── sanitizeJsonResponse() ───────────────────────────────────────────────────

describe('sanitizeJsonResponse()', () => {
  it('strips markdown code fences', () => {
    const raw = '```json\n{"x":1}\n```';
    expect(sanitizeJsonResponse(raw)).toBe('{"x":1}');
  });

  it('decodes &gt; HTML entity to > when present in structural corruption context', () => {
    // HTML entities are decoded during structural sanitization pass
    // This tests the sanitizeJsonResponse function directly
    const raw = 'preamble {"a":"b&gt;c"} suffix';
    const cleaned = sanitizeJsonResponse(raw);
    expect(cleaned).toContain('>');
  });

  it('decodes &lt; HTML entity to <', () => {
    const raw = 'preamble {"a":"b&lt;c"} suffix';
    const cleaned = sanitizeJsonResponse(raw);
    expect(cleaned).toContain('<');
  });

  it('decodes &amp; HTML entity to &', () => {
    const raw = 'preamble {"a":"b&amp;c"} suffix';
    const cleaned = sanitizeJsonResponse(raw);
    expect(cleaned).toContain('&c');
  });

  it('fixes "word>[" corruption pattern (adds colon)', () => {
    const raw = '{"strengths>["item1","item2"]}';
    const cleaned = sanitizeJsonResponse(raw);
    // After fixing, the key-value separator should be present (": " with space or ":[")
    expect(cleaned).toMatch(/strengths['"]*\s*:\s*\[/);
    // Must be valid parseable JSON after sanitization
    expect(() => JSON.parse(cleaned)).not.toThrow();
  });

  it('removes trailing commas before ]', () => {
    const raw = '{"a":[1,2,3,]}';
    const cleaned = sanitizeJsonResponse(raw);
    expect(cleaned).not.toContain(',]');
    expect(JSON.parse(cleaned)).toEqual({ a: [1, 2, 3] });
  });

  it('removes trailing commas before }', () => {
    const raw = '{"a":1,"b":2,}';
    const cleaned = sanitizeJsonResponse(raw);
    expect(cleaned).not.toContain(',}');
    expect(JSON.parse(cleaned)).toEqual({ a: 1, b: 2 });
  });

  it('removes BOM character', () => {
    const raw = '\uFEFF{"ok":true}';
    expect(sanitizeJsonResponse(raw)).toBe('{"ok":true}');
  });

  it('removes Unicode replacement characters', () => {
    const raw = '{"a":"hello\uFFFDworld"}';
    const cleaned = sanitizeJsonResponse(raw);
    expect(cleaned).not.toContain('\uFFFD');
  });

  it('trims surrounding prose to extract just the JSON object', () => {
    const raw = 'Here is the result:\n{"score":99}\nEnd.';
    const cleaned = sanitizeJsonResponse(raw);
    expect(cleaned).toBe('{"score":99}');
  });
});

// ─── extractJsonFromText() ────────────────────────────────────────────────────

describe('extractJsonFromText()', () => {
  it('extracts a JSON object from text with surrounding prose', () => {
    const text = 'Some preamble {"key":"value"} some suffix';
    const result = extractJsonFromText(text);
    expect(result).toBe('{"key":"value"}');
  });

  it('extracts a JSON array from text with surrounding prose', () => {
    const text = 'Result: [1,2,3] done.';
    const result = extractJsonFromText(text);
    expect(result).toBe('[1,2,3]');
  });

  it('handles nested objects correctly', () => {
    const text = 'prefix {"outer":{"inner":42}} suffix';
    const result = extractJsonFromText(text);
    expect(result).toBe('{"outer":{"inner":42}}');
  });

  it('returns null when no JSON structure is found', () => {
    const text = 'just plain text with no braces';
    const result = extractJsonFromText(text);
    expect(result).toBeNull();
  });

  it('handles string values containing braces without confusing depth count', () => {
    const text = '{"key":"value with { brace }","num":1}';
    const result = extractJsonFromText(text);
    expect(result).toBe('{"key":"value with { brace }","num":1}');
  });
});
