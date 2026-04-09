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
