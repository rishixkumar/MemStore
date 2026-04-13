export interface Memory {
  id: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  placeName: string;
  placeType: string;
  activityType: 'stationary' | 'walking' | 'commuting' | 'unknown';
  durationMinutes: number;
  peopleIds: string[];
  note: string | null;
  importanceScore: number;
  createdAt: number;
  onThisDayCaption?: string | null;
  audioUri?: string | null;
  memoryKind?: 'passive' | 'note' | 'voice';
}

export type MemoryKind = 'passive' | 'note' | 'voice';

export function getMemoryKind(memory: Pick<Memory, 'note' | 'audioUri' | 'memoryKind'>): MemoryKind {
  if (memory.audioUri) {
    return 'voice';
  }

  if (memory.note?.trim()) {
    return 'note';
  }

  return 'passive';
}

export interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  visitCount: number;
  lastVisited: number;
  placeType: string;
}
