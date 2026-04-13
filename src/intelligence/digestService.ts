import {
  deleteDigestForDate,
  getDigestForDate,
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

const DEV_MODE = true;
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
  console.log('Gemini prompt:', prompt);
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
  console.log('Gemini raw response:', JSON.stringify(data, null, 2));
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
  console.log('Ollama prompt:', prompt);
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
  console.log('Ollama raw response:', JSON.stringify(data, null, 2));
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
    } catch (err) {
      console.warn('Gemini unavailable, attempting Ollama fallback.', err);
    }
  }

  if (OLLAMA_BASE_URL) {
    try {
      const text = await callOllama(prompt, generationConfig);
      llmProviderInUse = 'ollama';
      return { text, provider: 'ollama' as const };
    } catch (err) {
      console.warn('Ollama fallback unavailable.', err);
      throw err;
    }
  }

  llmProviderInUse = 'fallback';
  throw new Error('No available LLM provider');
}

export function getActiveLlmProvider() {
  return llmProviderInUse;
}

export async function testGeminiConnection(): Promise<boolean> {
  console.log('Testing Gemini connection. Key present:', Boolean(GEMINI_API_KEY));
  if (!GEMINI_API_KEY) {
    console.warn('Gemini connection test failed: missing EXPO_PUBLIC_GEMINI_API_KEY');
    return false;
  }

  try {
    const text = await callGemini('Say hello in one sentence.', {
      maxOutputTokens: 40,
      temperature: 0.2,
    });
    console.log('Gemini connection test succeeded:', text);
    return true;
  } catch (err) {
    console.warn('Gemini connection test failed:', err);
    return false;
  }
}

export async function testOllamaConnection(): Promise<boolean> {
  console.log('Testing Ollama connection. Base URL present:', Boolean(OLLAMA_BASE_URL));
  if (!OLLAMA_BASE_URL) {
    console.warn('Ollama connection test skipped: missing EXPO_PUBLIC_OLLAMA_BASE_URL');
    return false;
  }

  try {
    const text = await callOllama('Say hello in one sentence.', {
      maxOutputTokens: 40,
      temperature: 0.2,
    });
    console.log('Ollama connection test succeeded:', text);
    return true;
  } catch (err) {
    console.warn('Ollama connection test failed:', err);
    return false;
  }
}

export async function generateDailyDigest(
  date: string,
  forceRefresh = false
): Promise<DailyDigestResult> {
  if (DEV_MODE) {
    await deleteDigestForDate(date);
  }

  const cached = await getDigestForDate(date);
  if (!DEV_MODE && cached && !forceRefresh) {
    llmProviderInUse = (cached.provider as LlmProvider) || 'fallback';
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
      const result = await callPreferredModel(prompt, {
        maxOutputTokens: 120,
        temperature: 0.9,
      });
      digestRetryAfter.delete(date);
      await saveDigest(date, result.text, result.provider);
      return { summary: result.text, provider: result.provider };
    } catch (err) {
      const errorText = String(err);
      if (errorText.includes('Gemini API error 429')) {
        digestRetryAfter.set(date, Date.now() + parseRetryDelayMs(errorText));
        console.warn('Gemini digest temporarily rate limited; using fallback summary.');
      } else {
        console.warn('Gemini digest unavailable; using fallback summary.', err);
      }
      llmProviderInUse = 'fallback';
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
      console.warn('On This Day caption unavailable; using fallback.', err);
      return fallback;
    } finally {
      onThisDayRequestsInFlight.delete(memory.id);
    }
  })();

  onThisDayRequestsInFlight.set(memory.id, request);
  return request;
}
