import { format } from 'date-fns';
import { Memory } from '../models/Memory';
import { formatMemoryTime } from '../utils/date';

export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) return 'No location data recorded for this day.';

  return memories
    .map((memory) => {
      const noteLine = memory.note ? ` | note: ${memory.note}` : '';
      return `${formatMemoryTime(memory.timestamp)} - ${memory.placeName}${noteLine}`;
    })
    .join('\n');
}

export function buildFallbackDigest(memories: Memory[]): string {
  return `You visited ${memories.length} place${memories.length !== 1 ? 's' : ''} today, including ${memories[0]?.placeName || 'somewhere'}.`;
}

export function buildDailyDigestPrompt(date: string, memories: Memory[]) {
  const displayDate = format(new Date(date), 'MMMM d, yyyy');
  const noteCount = memories.filter((memory) => Boolean(memory.note)).length;
  const specialInstruction =
    memories.length === 1
      ? 'There is only one memory today, so make it feel intimate, vivid, and complete.'
      : 'Connect the places and notes into one cohesive mood from the day.';

  return `You are a stylish, emotionally intelligent memory assistant.
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
${formatMemoriesForPrompt(memories)}

Write only the 3-4 line memory, nothing else.`;
}

export function buildMemoryCaptionPrompt(placeName: string, timestamp: number) {
  return `Write a single evocative, poetic sentence (max 12 words) about someone being at ${placeName} at ${formatMemoryTime(timestamp)}. No quotes. Just the sentence.`;
}
