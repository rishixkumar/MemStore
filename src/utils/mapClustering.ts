import { Memory } from '../models/Memory';
import { haversineDistance } from './geo';

export const MAP_CLUSTER_RADIUS_METERS = 100;

export type MemoryCluster = {
  id: string;
  latitude: number;
  longitude: number;
  memories: Memory[];
};

function clusterIndices(memories: Memory[], radiusMeters: number): number[][] {
  const n = memories.length;
  const parent = memories.map((_, i) => i);

  function find(i: number): number {
    if (parent[i] !== i) {
      parent[i] = find(parent[i]);
    }
    return parent[i];
  }

  function union(i: number, j: number) {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) {
      parent[rj] = ri;
    }
  }

  for (let i = 0; i < n; i++) {
    const a = memories[i];
    for (let j = i + 1; j < n; j++) {
      const b = memories[j];
      if (
        haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude) <= radiusMeters
      ) {
        union(i, j);
      }
    }
  }

  const buckets = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const list = buckets.get(r) ?? [];
    list.push(i);
    buckets.set(r, list);
  }

  return [...buckets.values()];
}

function centroid(memories: Memory[]): { latitude: number; longitude: number } {
  const sum = memories.reduce(
    (acc, m) => {
      acc.lat += m.latitude;
      acc.lon += m.longitude;
      return acc;
    },
    { lat: 0, lon: 0 }
  );
  const n = memories.length || 1;
  return { latitude: sum.lat / n, longitude: sum.lon / n };
}

export function clusterMemoriesByProximity(
  memories: Memory[],
  radiusMeters = MAP_CLUSTER_RADIUS_METERS
): MemoryCluster[] {
  if (memories.length === 0) {
    return [];
  }

  const groups = clusterIndices(memories, radiusMeters);
  return groups.map((indices, idx) => {
    const group = indices.map((i) => memories[i]);
    const { latitude, longitude } = centroid(group);
    const sorted = [...group].sort((a, b) => b.timestamp - a.timestamp);
    return {
      id: `cluster-${idx}-${sorted[0]?.id ?? idx}`,
      latitude,
      longitude,
      memories: sorted,
    };
  });
}
