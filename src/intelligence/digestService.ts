import {
  deleteDigestForDate,
  getDigestForDate,
  getMemoriesForDate,
  saveDigest,
  saveOnThisDayCaption,
} from '../storage/database';
import { Memory } from '../models/Memory';
import { format } from 'date-fns';

const DEV_MODE = true;
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const OLLAMA_BASE_URL = (process.env.EXPO_PUBLIC_OLLAMA_BASE_URL || '').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.EXPO_PUBLIC_OLLAMA_MODEL || 'llama3.2';
const digestRequestsInFlight = new Map<string, Promise<string>>();
const digestRetryAfter = new Map<string, number>();
const onThisDayRequestsInFlight = new Map<string, Promise<string>>();
let llmProviderInUse: 'gemini' | 'ollama' | 'fallback' = 'fallback';

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

function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) return 'No location data recorded for this day.';
  return memories
    .map((m) => {
      const time = format(new Date(m.timestamp), 'h:mm a');
      const noteLine = m.note ? ` | note: ${m.note}` : '';
      return `${time} - ${m.placeName}${noteLine}`;
    })
    .join('\n');
}

function buildFallbackDigest(memories: Memory[]): string {
  return `You visited ${memories.length} place${memories.length !== 1 ? 's' : ''} today, including ${memories[0]?.placeName || 'somewhere'}.`;
}

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
      return text;
    } catch (err) {
      console.warn('Gemini unavailable, attempting Ollama fallback.', err);
    }
  }

  if (OLLAMA_BASE_URL) {
    try {
      const text = await callOllama(prompt, generationConfig);
      llmProviderInUse = 'ollama';
      return text;
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

export async function generateDailyDigest(date: string, forceRefresh = false): Promise<string> {
  if (DEV_MODE) {
    await deleteDigestForDate(date);
  }

  const cached = await getDigestForDate(date);
  if (!DEV_MODE && cached && !forceRefresh) return cached;

  const memories = await getMemoriesForDate(date);

  if (memories.length === 0) {
    return 'No memories captured today yet. Walk around with the app running and your day will start appearing here.';
  }

  const retryAt = digestRetryAfter.get(date) || 0;
  if (!forceRefresh && retryAt > Date.now()) {
    return buildFallbackDigest(memories);
  }

  const existingRequest = digestRequestsInFlight.get(date);
  if (existingRequest) {
    return existingRequest;
  }

  if (!GEMINI_API_KEY && !OLLAMA_BASE_URL) {
    return buildFallbackDigest(memories);
  }

  const memoryText = formatMemoriesForPrompt(memories);
  const displayDate = format(new Date(date), 'MMMM d, yyyy');
  const noteCount = memories.filter((memory) => Boolean(memory.note)).length;
  const specialInstruction =
    memories.length === 1
      ? 'There is only one memory today, so make it feel intimate, vivid, and complete.'
      : 'Connect the places and notes into one cohesive mood from the day.';

  const prompt = `You are a stylish, emotionally intelligent memory assistant.
Date: ${displayDate}
Entries: ${memories.length}
Manual notes included: ${noteCount}

Write a cool, concise daily memory in first person and past tense.
Return exactly 3-4 short lines.
Each line should feel cinematic, warm, and human.
Keep it tight and memorable, not verbose.
Mention the place naturally, weave in any notes when relevant, and avoid sounding robotic.
Do not use bullet points, numbering, titles, or quotation marks.
${specialInstruction}

Location timeline:
${memoryText}

Write only the 3-4 line memory, nothing else.`;

  const request = (async () => {
    try {
      const summary = await callPreferredModel(prompt, {
        maxOutputTokens: 120,
        temperature: 0.9,
      });
      digestRetryAfter.delete(date);
      await saveDigest(date, summary);
      return summary;
    } catch (err) {
      const errorText = String(err);
      if (errorText.includes('Gemini API error 429')) {
        digestRetryAfter.set(date, Date.now() + parseRetryDelayMs(errorText));
        console.warn('Gemini digest temporarily rate limited; using fallback summary.');
      } else {
        console.warn('Gemini digest unavailable; using fallback summary.', err);
      }
      llmProviderInUse = 'fallback';
      return buildFallbackDigest(memories);
    } finally {
      digestRequestsInFlight.delete(date);
    }
  })();

  digestRequestsInFlight.set(date, request);
  return request;
}

export async function generateMemoryCaption(placeName: string, timestamp: number): Promise<string> {
  if (!GEMINI_API_KEY && !OLLAMA_BASE_URL) return '';

  const time = format(new Date(timestamp), 'h:mm a');
  const prompt = `Write a single evocative, poetic sentence (max 12 words) about someone being at ${placeName} at ${time}. No quotes. Just the sentence.`;

  try {
    return await callPreferredModel(prompt, {
      maxOutputTokens: 40,
      temperature: 1.0,
    });
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

  const formattedDate = format(new Date(memory.timestamp), 'MMMM d, yyyy');
  const fallback = `You were here on ${formattedDate}.`;

  if (!GEMINI_API_KEY && !OLLAMA_BASE_URL) {
    return fallback;
  }

  const prompt = `In one warm sentence, reflect on someone having been at ${memory.placeName} on ${formattedDate}. Keep it concise, human, and emotionally resonant.`;

  const request = (async () => {
    try {
      const caption = await callPreferredModel(prompt, {
        maxOutputTokens: 50,
        temperature: 0.9,
      });
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
