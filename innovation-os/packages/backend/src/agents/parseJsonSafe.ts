import { AgentParseError } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * Sanitizes a raw LLM response string before JSON parsing.
 *
 * Handles known corruption patterns produced by Gemini and other LLMs:
 * - Markdown code fences (```json ... ```)
 * - HTML entity artifacts: &gt; → >, &lt; → <, &amp; → &, &quot; → "
 * - Stray HTML/XML tag fragments before array brackets: e.g. strengths>[  → strengths":[
 * - Unicode replacement characters (U+FFFD)
 * - Trailing commas before } or ] (not valid JSON)
 * - Single-quoted strings converted to double-quoted
 * - BOM characters at the start of the string
 */
export function sanitizeJsonResponse(raw: string): string {
  let s = raw;

  // Remove BOM
  s = s.replace(/^\uFEFF/, '');

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  s = s.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '');

  // Strip any leading/trailing text that isn't part of the JSON object/array
  // Find the first { or [ and last } or ]
  const firstBrace = s.search(/[{[]/);
  const lastBrace = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }

  // Decode HTML entities that Gemini occasionally injects
  s = s
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // Fix corruption pattern: key>[ or key>{ → key":[  or key":{
  // e.g. "strengths>[  becomes  "strengths":[
  // Pattern: a word character followed by > followed by [ or {
  s = s.replace(/(\w)>\s*(\[|\{)/g, '$1": $2');

  // Fix corruption pattern: key>value  when key is mid-string
  // e.g. "strengths>["item"] → "strengths": ["item"]
  s = s.replace(/"(\w+)>\s*\[/g, '"$1": [');
  s = s.replace(/"(\w+)>\s*\{/g, '"$1": {');

  // Remove Unicode replacement characters
  s = s.replace(/\uFFFD/g, '');

  // Remove trailing commas before } or ] (invalid JSON)
  s = s.replace(/,\s*([}\]])/g, '$1');

  // Remove null bytes
  s = s.replace(/\0/g, '');

  return s.trim();
}

/**
 * Attempts to parse a raw LLM response string as JSON.
 * Applies sanitization before parsing to recover from common LLM formatting errors.
 * Throws AgentParseError on failure.
 */
export function parseJsonSafe<T>(raw: string, agentType: string): T {
  // ── Pass 1: Try parsing the raw string after light code-fence stripping only ──
  // This preserves all string content intact for valid JSON responses.
  const lightCleaned = raw
    .replace(/^\uFEFF/, '')                         // BOM
    .replace(/^```(?:json)?\s*/im, '')              // opening code fence
    .replace(/\s*```\s*$/m, '')                     // closing code fence
    .trim();

  try {
    return JSON.parse(lightCleaned) as T;
  } catch {
    // Proceed to full sanitization pass
  }

  // ── Pass 2: Full sanitization — only applied when light parse fails ──
  const sanitized = sanitizeJsonResponse(raw);

  try {
    return JSON.parse(sanitized) as T;
  } catch (firstError) {
    logger.warn(
      { agentType, sanitizedLength: sanitized.length, rawLength: raw.length },
      'Initial JSON parse failed after sanitization — attempting fallback extraction'
    );

    // ── Pass 3: Extract balanced JSON structure from surrounding text ──
    const extracted = extractJsonFromText(sanitized);
    if (extracted !== null) {
      try {
        return JSON.parse(extracted) as T;
      } catch {
        // fall through to throw
      }
    }

    throw new AgentParseError(
      `Failed to parse JSON response from ${agentType} agent: ${firstError instanceof Error ? firstError.message : 'unknown parse error'}`,
      agentType,
      raw
    );
  }
}

/**
 * Attempts to extract a valid JSON object or array from a string that may
 * contain surrounding text by scanning for balanced braces/brackets.
 * Returns the extracted JSON string, or null if not found.
 */
export function extractJsonFromText(text: string): string | null {
  // Try to find a balanced JSON object {}
  const objStart = text.indexOf('{');
  if (objStart !== -1) {
    const extracted = extractBalanced(text, objStart, '{', '}');
    if (extracted) return extracted;
  }

  // Try to find a balanced JSON array []
  const arrStart = text.indexOf('[');
  if (arrStart !== -1) {
    const extracted = extractBalanced(text, arrStart, '[', ']');
    if (extracted) return extracted;
  }

  return null;
}

function extractBalanced(
  text: string,
  start: number,
  open: string,
  close: string
): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}
