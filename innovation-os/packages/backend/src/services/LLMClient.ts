import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import logger from '../lib/logger';

// System instruction appended to every call to enforce JSON-only output
const JSON_ONLY_INSTRUCTION =
  'You must respond with valid JSON only. Do not include markdown code fences, explanations, or any text outside the JSON object.';

export class LLMClient {
  private gemini: GoogleGenerativeAI | null = null;
  private openaiClient: OpenAI | null = null;

  constructor() {
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    if (process.env.OPENAI_COMPATIBLE_API_URL) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'no-key',
        baseURL: process.env.OPENAI_COMPATIBLE_API_URL,
      });
    }
  }

  /**
   * Sends a prompt to the LLM and returns the raw text response.
   * Tries Gemini first; falls back to OpenAI-compatible API if configured.
   * Both providers are instructed to return JSON only.
   */
  async complete(systemContext: string, userPrompt: string): Promise<string> {
    const fullSystemContext = `${systemContext}\n\n${JSON_ONLY_INSTRUCTION}`;

    if (this.gemini) {
      try {
        return await this.callGemini(fullSystemContext, userPrompt);
      } catch (error) {
        logger.warn({ error }, 'Gemini API call failed, attempting fallback');
        if (this.openaiClient) {
          return await this.callOpenAICompatible(fullSystemContext, userPrompt);
        }
        throw error;
      }
    }

    if (this.openaiClient) {
      return await this.callOpenAICompatible(fullSystemContext, userPrompt);
    }

    throw new Error(
      'No LLM provider configured. Set GEMINI_API_KEY or OPENAI_COMPATIBLE_API_URL environment variable.'
    );
  }

  private async callGemini(systemContext: string, userPrompt: string): Promise<string> {
    if (!this.gemini) throw new Error('Gemini client not initialized');

    const model = this.gemini.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      systemInstruction: systemContext,
      generationConfig: {
        temperature: 0,          // deterministic output — reduces JSON malformation
        candidateCount: 1,
      },
    });

    let result;
    try {
      result = await model.generateContent(userPrompt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ error: message }, 'Gemini generateContent failed');
      throw err;
    }

    const candidate = result.response.candidates?.[0];
    if (!candidate) {
      const blockReason = result.response.promptFeedback?.blockReason;
      throw new Error(
        `Gemini returned no candidates${blockReason ? ` (blocked: ${blockReason})` : ''}`
      );
    }

    const text = result.response.text();
    if (!text) throw new Error('Gemini returned empty text response');

    logger.debug(
      { responseLength: text.length, finishReason: candidate.finishReason },
      'Gemini response received'
    );

    return text;
  }

  private async callOpenAICompatible(systemContext: string, userPrompt: string): Promise<string> {
    if (!this.openaiClient) throw new Error('OpenAI-compatible client not initialized');

    const completion = await this.openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemContext },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error('OpenAI-compatible API returned empty response');
    return text;
  }

  /**
   * Like complete(), but does NOT append the JSON_ONLY_INSTRUCTION.
   * Used for free-text responses (e.g. executive summary generation).
   * Tries Gemini first; falls back to OpenAI-compatible if configured.
   */
  async completeText(systemContext: string, userPrompt: string): Promise<string> {
    if (this.gemini) {
      try {
        return await this.callGemini(systemContext, userPrompt);
      } catch (error) {
        logger.warn({ error }, 'Gemini API call failed, attempting fallback');
        if (this.openaiClient) {
          return await this.callOpenAICompatibleText(systemContext, userPrompt);
        }
        throw error;
      }
    }

    if (this.openaiClient) {
      return await this.callOpenAICompatibleText(systemContext, userPrompt);
    }

    throw new Error(
      'No LLM provider configured. Set GEMINI_API_KEY or OPENAI_COMPATIBLE_API_URL environment variable.'
    );
  }

  private async callOpenAICompatibleText(systemContext: string, userPrompt: string): Promise<string> {
    if (!this.openaiClient) throw new Error('OpenAI-compatible client not initialized');

    const completion = await this.openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemContext },
        { role: 'user', content: userPrompt },
      ],
      // No response_format — plain text output
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error('OpenAI-compatible API returned empty response');
    return text;
  }
}

// Singleton instance — shared across all agents
export const llmClient = new LLMClient();
