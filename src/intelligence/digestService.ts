import { getMemoriesForDate, saveDigest, getDigestForDate } from '../storage/database';
import { Memory } from '../models/Memory';
import { format } from 'date-fns';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const digestRequestsInFlight = new Map<string, Promise<string>>();
const digestRetryAfter = new Map<string, number>();

function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) return 'No location data recorded for this day.';
  return memories
    .map((m) => {
      const time = format(new Date(m.timestamp), 'h:mm a');
      return `${time} - ${m.placeName}`;
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

export async function generateDailyDigest(date: string, forceRefresh = false): Promise<string> {
  const cached = await getDigestForDate(date);
  if (cached && !forceRefresh) return cached;

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

  if (!GEMINI_API_KEY) {
    return buildFallbackDigest(memories);
  }

  const memoryText = formatMemoriesForPrompt(memories);
  const displayDate = format(new Date(date), 'MMMM d, yyyy');

  const prompt = `You are a warm, reflective personal memory assistant. Based on the locations someone visited on ${displayDate}, write a brief, human, first-person diary-style summary of their day in 2-3 sentences. Be specific about the places. Sound like a thoughtful friend reflecting on the day, not a robot listing locations. Do not mention timestamps or use bullet points.

Location timeline:
${memoryText}

Write only the summary, nothing else.`;

  const request = (async () => {
    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.8 },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429) {
          digestRetryAfter.set(date, Date.now() + parseRetryDelayMs(errText));
          console.warn('Gemini digest temporarily rate limited; using fallback summary.');
          return buildFallbackDigest(memories);
        }
        throw new Error(`Gemini API error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!summary) throw new Error('Empty response from Gemini');

      digestRetryAfter.delete(date);
      await saveDigest(date, summary);
      return summary;
    } catch (err) {
      console.warn('Gemini digest unavailable; using fallback summary.', err);
      return buildFallbackDigest(memories);
    } finally {
      digestRequestsInFlight.delete(date);
    }
  })();

  digestRequestsInFlight.set(date, request);
  return request;
}

export async function generateMemoryCaption(placeName: string, timestamp: number): Promise<string> {
  if (!GEMINI_API_KEY) return '';

  const time = format(new Date(timestamp), 'h:mm a');
  const prompt = `Write a single evocative, poetic sentence (max 12 words) about someone being at ${placeName} at ${time}. No quotes. Just the sentence.`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 40, temperature: 1.0 },
      }),
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  } catch {
    return '';
  }
}
