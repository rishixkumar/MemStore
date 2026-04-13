import {
  getDigestForDate,
  saveDigestHistoryEntry,
  getMemoriesForDate,
  saveDigest,
  saveOnThisDayCaption,
} from '../storage/database';
import {
  buildDailyDigestPrompt,
  buildFallbackDigest,
  buildMemoryCaptionPrompt,
} from './digestPrompts';
import { Memory } from '../models/Memory';
import { logger } from '../utils/logger';
import { getTenMinuteSlotStart } from '../utils/date';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const OLLAMA_BASE_URL = (process.env.EXPO_PUBLIC_OLLAMA_BASE_URL || '').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.EXPO_PUBLIC_OLLAMA_MODEL || 'llama3.2';
const digestRequestsInFlight = new Map<string, Promise<DailyDigestResult>>();
const digestRetryAfter = new Map<string, number>();
const onThisDayRequestsInFlight = new Map<string, Promise<string>>();
export type LlmProvider = 'gemini' | 'ollama' | 'fallback';
let llmProviderInUse: LlmProvider = 'fallback';

export type DailyDigestResult = {
  summary: string;
  provider: LlmProvider;
};

type GeminiGenerationConfig = {
  maxOutputTokens: number;
  temperature: number;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type OllamaResponse = {
  response?: string;
};

function parseRetryDelayMs(errorText: string): number {
  const match = errorText.match(/"retryDelay":\s*"(\d+)s"/);
  if (!match) return 60_000;
  return Number(match[1]) * 1000;
}

async function callGemini(prompt: string, generationConfig: GeminiGenerationConfig) {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data: GeminiResponse = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error('Empty response from Gemini');
  }
  return text;
}

async function callOllama(prompt: string, generationConfig: GeminiGenerationConfig) {
  if (!OLLAMA_BASE_URL) {
    throw new Error('Ollama base URL is not configured');
  }

  const ollamaUrl = `${OLLAMA_BASE_URL}/api/generate`;
  const response = await fetch(ollamaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: generationConfig.temperature,
        num_predict: generationConfig.maxOutputTokens,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama error ${response.status}: ${errText}`);
  }

  const data: OllamaResponse = await response.json();
  const text = data.response?.trim();
  if (!text) {
    throw new Error('Empty response from Ollama');
  }
  return text;
}

async function callPreferredModel(prompt: string, generationConfig: GeminiGenerationConfig) {
  if (GEMINI_API_KEY) {
    try {
      const text = await callGemini(prompt, generationConfig);
      llmProviderInUse = 'gemini';
      return { text, provider: 'gemini' as const };
    } catch {
      logger.warn('LLM', 'Gemini unavailable, trying Ollama fallback.');
    }
  }

  if (OLLAMA_BASE_URL) {
    try {
      const text = await callOllama(prompt, generationConfig);
      llmProviderInUse = 'ollama';
      return { text, provider: 'ollama' as const };
    } catch (err) {
      logger.warn('LLM', 'Ollama unavailable during fallback.', err);
      throw err;
    }
  }

  llmProviderInUse = 'fallback';
  throw new Error('No available LLM provider');
}

export async function generateDailyDigest(
  date: string,
  forceRefresh = false
): Promise<DailyDigestResult> {
  const cached = await getDigestForDate(date);
  const currentSlotStart = getTenMinuteSlotStart();
  const hasFreshCache = cached ? cached.createdAt >= currentSlotStart : false;

  if (cached && !forceRefresh && hasFreshCache) {
    llmProviderInUse = (cached.provider as LlmProvider) || 'fallback';
    logger.info('Digest', `Using cached daily digest (${llmProviderInUse}).`);
    return { summary: cached.summary, provider: llmProviderInUse };
  }

  const memories = await getMemoriesForDate(date);

  if (memories.length === 0) {
    return {
      summary:
        'No memories captured today yet. Walk around with the app running and your day will start appearing here.',
      provider: 'fallback',
    };
  }

  const retryAt = digestRetryAfter.get(date) || 0;
  if (!forceRefresh && retryAt > Date.now()) {
    if (cached) {
      llmProviderInUse = (cached.provider as LlmProvider) || 'fallback';
      logger.info('Digest', `Using cached digest during retry window (${llmProviderInUse}).`);
      return { summary: cached.summary, provider: llmProviderInUse };
    }
    logger.warn('Digest', 'Provider retry window active; using fallback digest.');
    return { summary: buildFallbackDigest(memories), provider: 'fallback' };
  }

  const existingRequest = digestRequestsInFlight.get(date);
  if (existingRequest) {
    return existingRequest;
  }

  if (!GEMINI_API_KEY && !OLLAMA_BASE_URL) {
    return { summary: buildFallbackDigest(memories), provider: 'fallback' };
  }

  const prompt = buildDailyDigestPrompt(date, memories);

  const request: Promise<DailyDigestResult> = (async () => {
    try {
      logger.info('Digest', forceRefresh ? 'Refreshing daily digest.' : 'Generating daily digest.');
      const result = await callPreferredModel(prompt, {
        maxOutputTokens: 120,
        temperature: 0.9,
      });
      digestRetryAfter.delete(date);
      await saveDigest(date, result.text, result.provider);
      await saveDigestHistoryEntry({
        date,
        summary: result.text,
        provider: result.provider,
        placeName: memories[memories.length - 1]?.placeName || 'Unknown location',
      });
      logger.info('Digest', `Daily digest ready (${result.provider}).`);
      return { summary: result.text, provider: result.provider };
    } catch (err) {
      const errorText = String(err);
      if (errorText.includes('Gemini API error 429')) {
        digestRetryAfter.set(date, Date.now() + parseRetryDelayMs(errorText));
        logger.warn('Digest', 'Gemini rate limited; delaying retries.');
      } else {
        logger.warn('Digest', 'LLM digest unavailable; falling back.', err);
      }
      if (cached) {
        llmProviderInUse = (cached.provider as LlmProvider) || 'fallback';
        logger.info('Digest', `Reusing previous cached digest (${llmProviderInUse}).`);
        return { summary: cached.summary, provider: llmProviderInUse };
      }
      llmProviderInUse = 'fallback';
      logger.warn('Digest', 'No cached digest available; using local fallback summary.');
      return { summary: buildFallbackDigest(memories), provider: 'fallback' };
    } finally {
      digestRequestsInFlight.delete(date);
    }
  })();

  digestRequestsInFlight.set(date, request);
  return request;
}

export async function generateMemoryCaption(placeName: string, timestamp: number): Promise<string> {
  if (!GEMINI_API_KEY && !OLLAMA_BASE_URL) return '';

  const prompt = buildMemoryCaptionPrompt(placeName, timestamp);

  try {
    const result = await callPreferredModel(prompt, {
      maxOutputTokens: 40,
      temperature: 1.0,
    });
    return result.text;
  } catch {
    return '';
  }
}

export async function generateOnThisDayCaption(memory: Memory): Promise<string> {
  if (memory.onThisDayCaption) {
    return memory.onThisDayCaption;
  }

  const existingRequest = onThisDayRequestsInFlight.get(memory.id);
  if (existingRequest) {
    return existingRequest;
  }

  const fallback = 'You were here.';

  if (!GEMINI_API_KEY && !OLLAMA_BASE_URL) {
    return fallback;
  }

  const request = (async () => {
    try {
      const caption = await generateMemoryCaption(memory.placeName, memory.timestamp);
      if (!caption) {
        return fallback;
      }
      await saveOnThisDayCaption(memory.id, caption);
      return caption;
    } catch (err) {
      logger.warn('OnThisDay', 'Caption generation unavailable; using fallback.', err);
      return fallback;
    } finally {
      onThisDayRequestsInFlight.delete(memory.id);
    }
  })();

  onThisDayRequestsInFlight.set(memory.id, request);
  return request;
}
