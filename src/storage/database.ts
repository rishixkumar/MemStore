import * as SQLite from 'expo-sqlite';
import { endOfWeek, startOfWeek, subWeeks, format } from 'date-fns';
import { getMemoryKind, Memory, Place } from '../models/Memory';
import {
  MEMORY_DEDUP_RADIUS_METERS,
  MEMORY_DEDUP_WINDOW_MS,
  PLACE_MATCH_RADIUS_METERS,
} from '../config/app';
import {
  getDayRangeForDateKey,
  getDaysAgoRange,
  toLocalDateKey,
} from '../utils/date';
import { haversineDistance } from '../utils/geo';

const DB_NAME = 'ambientmemory.db';

export type DigestHistoryEntry = {
  id: string;
  date: string;
  summary: string;
  provider: string;
  placeName: string;
  createdAt: number;
};

export async function getDatabase() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  return db;
}

export async function initializeDatabase() {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      place_name TEXT NOT NULL,
      place_type TEXT DEFAULT 'unknown',
      activity_type TEXT DEFAULT 'unknown',
      duration_minutes REAL DEFAULT 0,
      people_ids TEXT DEFAULT '[]',
      note TEXT,
      importance_score REAL DEFAULT 0.5,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS places (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      visit_count INTEGER DEFAULT 1,
      last_visited INTEGER NOT NULL,
      place_type TEXT DEFAULT 'unknown'
    );

    CREATE TABLE IF NOT EXISTS digests (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      provider TEXT DEFAULT 'fallback',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS digest_history (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      summary TEXT NOT NULL,
      provider TEXT DEFAULT 'fallback',
      place_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_place ON memories(place_name);
    CREATE INDEX IF NOT EXISTS idx_digest_history_created_at ON digest_history(created_at DESC);
  `);

  const memoryColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(memories)');
  const hasOnThisDayCaption = memoryColumns.some(
    (column) => column.name === 'on_this_day_caption' || column.name === 'otd_caption'
  );
  if (!hasOnThisDayCaption) {
    await db.execAsync('ALTER TABLE memories ADD COLUMN otd_caption TEXT;');
  }
  const hasLegacyOnThisDayCaption = memoryColumns.some(
    (column) => column.name === 'on_this_day_caption'
  );
  const hasOtdCaption = memoryColumns.some((column) => column.name === 'otd_caption');
  if (hasLegacyOnThisDayCaption && !hasOtdCaption) {
    await db.execAsync('ALTER TABLE memories ADD COLUMN otd_caption TEXT;');
    await db.execAsync(
      'UPDATE memories SET otd_caption = on_this_day_caption WHERE otd_caption IS NULL AND on_this_day_caption IS NOT NULL;'
    );
  }
  const hasAudioUri = memoryColumns.some((column) => column.name === 'audio_uri');
  if (!hasAudioUri) {
    await db.execAsync('ALTER TABLE memories ADD COLUMN audio_uri TEXT;');
  }
  const hasMemoryKind = memoryColumns.some((column) => column.name === 'memory_kind');
  if (!hasMemoryKind) {
    await db.execAsync("ALTER TABLE memories ADD COLUMN memory_kind TEXT DEFAULT 'passive';");
  }
  const digestColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(digests)');
  const hasDigestProvider = digestColumns.some((column) => column.name === 'provider');
  if (!hasDigestProvider) {
    await db.execAsync("ALTER TABLE digests ADD COLUMN provider TEXT DEFAULT 'fallback';");
  }

  return db;
}

function mapMemoryRow(row: any): Memory {
  return {
    id: row.id,
    timestamp: row.timestamp,
    latitude: row.latitude,
    longitude: row.longitude,
    placeName: row.place_name,
    placeType: row.place_type,
    activityType: row.activity_type,
    durationMinutes: row.duration_minutes,
    peopleIds: JSON.parse(row.people_ids || '[]'),
    note: row.note,
    importanceScore: row.importance_score,
    createdAt: row.created_at,
    onThisDayCaption: row.otd_caption ?? row.on_this_day_caption,
    audioUri: row.audio_uri,
    memoryKind: getMemoryKind({
      memoryKind: row.memory_kind,
      audioUri: row.audio_uri,
      note: row.note,
    }),
  };
}

export async function insertMemory(memory: Memory): Promise<boolean> {
  const db = await getDatabase();

  const shouldDeduplicate = !memory.note && memory.placeType !== 'manual';

  if (shouldDeduplicate) {
    // Deduplication: skip if we have a memory within 200m in the last 10 minutes
    const tenMinutesAgo = memory.timestamp - MEMORY_DEDUP_WINDOW_MS;
    const recent = await db.getAllAsync<any>(
      'SELECT * FROM memories WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 20',
      [tenMinutesAgo]
    );

    for (const row of recent) {
      const dist = haversineDistance(
        memory.latitude,
        memory.longitude,
        row.latitude,
        row.longitude
      );
      if (dist < MEMORY_DEDUP_RADIUS_METERS) {
        return false;
      }
    }
  }

  await db.runAsync(
    `INSERT OR REPLACE INTO memories
     (id, timestamp, latitude, longitude, place_name, place_type, activity_type, duration_minutes, people_ids, note, importance_score, created_at, otd_caption, audio_uri, memory_kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      memory.id,
      memory.timestamp,
      memory.latitude,
      memory.longitude,
      memory.placeName,
      memory.placeType,
      memory.activityType,
      memory.durationMinutes,
      JSON.stringify(memory.peopleIds),
      memory.note,
      memory.importanceScore,
      memory.createdAt,
      memory.onThisDayCaption || null,
      memory.audioUri || null,
      getMemoryKind(memory),
    ]
  );

  await upsertPlace(memory);
  return true;
}

async function upsertPlace(memory: Memory) {
  const db = await getDatabase();
  const existing = await db.getAllAsync<Place & { id: string }>('SELECT * FROM places', []);

  for (const place of existing) {
    const dist = haversineDistance(
      memory.latitude,
      memory.longitude,
      place.latitude,
      place.longitude
    );
    if (dist < PLACE_MATCH_RADIUS_METERS) {
      await db.runAsync(
        'UPDATE places SET visit_count = visit_count + 1, last_visited = ? WHERE id = ?',
        [memory.timestamp, place.id]
      );
      return;
    }
  }

  await db.runAsync(
    `INSERT INTO places (id, name, latitude, longitude, visit_count, last_visited, place_type)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [
      `place-${Date.now()}`,
      memory.placeName,
      memory.latitude,
      memory.longitude,
      memory.timestamp,
      memory.placeType,
    ]
  );
}

export async function getAllMemories(): Promise<Memory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM memories ORDER BY timestamp DESC');
  return rows.map(mapMemoryRow);
}

/** Memories with a real coordinate (excludes 0,0 placeholder rows). */
export async function getAllMemoriesWithCoords(): Promise<Memory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM memories
     WHERE ABS(latitude) > 1e-8 AND ABS(longitude) > 1e-8
     ORDER BY timestamp DESC`
  );
  return rows.map(mapMemoryRow);
}

export async function getMemoriesForDate(date: string): Promise<Memory[]> {
  const db = await getDatabase();
  const { start, end } = getDayRangeForDateKey(date);

  const rows = await db.getAllAsync<any>(
    'SELECT * FROM memories WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC',
    [start.getTime(), end.getTime()]
  );

  return rows.map(mapMemoryRow);
}

export async function getMemoriesForDateRange(startTs: number, endTs: number): Promise<Memory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM memories WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
    [startTs, endTs]
  );
  return rows.map(mapMemoryRow);
}

export async function getHourlyDistribution(): Promise<number[]> {
  const db = await getDatabase();
  const counts = new Array(24).fill(0);
  const rows = await db.getAllAsync<{ hour: string; c: number }>(
    `SELECT strftime('%H', timestamp / 1000, 'unixepoch', 'localtime') AS hour, COUNT(*) AS c
     FROM memories
     GROUP BY hour`
  );
  for (const row of rows) {
    const h = Number.parseInt(row.hour, 10);
    if (!Number.isNaN(h) && h >= 0 && h < 24) {
      counts[h] = row.c;
    }
  }
  return counts;
}

export type PlaceVisitStat = {
  placeName: string;
  visitCount: number;
};

export async function getTopPlacesByVisits(
  limit: number,
  startTs?: number,
  endTs?: number
): Promise<PlaceVisitStat[]> {
  const db = await getDatabase();
  if (startTs !== undefined && endTs !== undefined) {
    const rows = await db.getAllAsync<{ place_name: string; cnt: number }>(
      `SELECT place_name, COUNT(*) AS cnt
       FROM memories
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY place_name
       ORDER BY cnt DESC
       LIMIT ?`,
      [startTs, endTs, limit]
    );
    return rows.map((row) => ({ placeName: row.place_name, visitCount: row.cnt }));
  }

  const rows = await db.getAllAsync<{ place_name: string; cnt: number }>(
    `SELECT place_name, COUNT(*) AS cnt
     FROM memories
     GROUP BY place_name
     ORDER BY cnt DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((row) => ({ placeName: row.place_name, visitCount: row.cnt }));
}

export type WeeklyNewPlaceBucket = {
  weekStart: number;
  weekEnd: number;
  label: string;
  newPlaceCount: number;
};

export async function getWeeklyNewPlaces(weeksBack: number): Promise<WeeklyNewPlaceBucket[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ first_ts: number }>(
    'SELECT MIN(timestamp) AS first_ts FROM memories GROUP BY place_name'
  );

  const buckets: WeeklyNewPlaceBucket[] = [];
  const n = Math.max(1, Math.floor(weeksBack));

  for (let i = n - 1; i >= 0; i -= 1) {
    const anchor = subWeeks(new Date(), i);
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    const end = endOfWeek(anchor, { weekStartsOn: 1 });
    const startTs = start.getTime();
    const endTs = end.getTime();

    const newPlaceCount = rows.filter((r) => r.first_ts >= startTs && r.first_ts <= endTs).length;

    buckets.push({
      weekStart: startTs,
      weekEnd: endTs,
      label: format(start, 'MMM d'),
      newPlaceCount,
    });
  }

  return buckets;
}

export async function getTopMemoriesByImportance(limit: number): Promise<Memory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM memories ORDER BY importance_score DESC, timestamp DESC LIMIT ?',
    [limit]
  );
  return rows.map(mapMemoryRow);
}

export async function saveDigest(date: string, summary: string, provider = 'fallback') {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO digests (id, date, summary, provider, created_at) VALUES (?, ?, ?, ?, ?)`,
    [`digest-${date}`, date, summary, provider, Date.now()]
  );
}

export async function saveDigestHistoryEntry(
  entry: Omit<DigestHistoryEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: number }
) {
  const db = await getDatabase();
  const createdAt = entry.createdAt ?? Date.now();
  const id = entry.id ?? `digest-history-${createdAt}-${Math.random().toString(36).slice(2, 9)}`;

  await db.runAsync(
    `INSERT INTO digest_history (id, date, summary, provider, place_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, entry.date, entry.summary, entry.provider, entry.placeName, createdAt]
  );
}

export async function getDigestHistoryEntries(): Promise<DigestHistoryEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT id, date, summary, provider, place_name, created_at FROM digest_history ORDER BY created_at DESC'
  );

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    summary: row.summary,
    provider: row.provider || 'fallback',
    placeName: row.place_name,
    createdAt: row.created_at,
  }));
}

export async function getDigestForDate(
  date: string
): Promise<{ summary: string; provider: string; createdAt: number } | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT summary, provider, created_at FROM digests WHERE date = ?', [
    date,
  ]);
  return row
    ? {
        summary: row.summary,
        provider: row.provider || 'fallback',
        createdAt: row.created_at,
      }
    : null;
}

export async function clearAllMemories() {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM memories; DELETE FROM places; DELETE FROM digests; DELETE FROM digest_history;');
}

export async function deleteDigestForDate(date: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM digests WHERE date = ?', [date]);
}

export async function updateMemory(
  memoryId: string,
  updates: Partial<Pick<Memory, 'note' | 'placeName' | 'audioUri' | 'memoryKind'>>
) {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: Array<string | null> = [];
  let nextNote: string | null | undefined;
  let nextAudioUri: string | null | undefined;
  let shouldRecomputeKind = false;

  if (updates.note !== undefined) {
    fields.push('note = ?');
    values.push(updates.note);
    nextNote = updates.note;
    shouldRecomputeKind = true;
  }
  if (updates.placeName !== undefined) {
    fields.push('place_name = ?');
    values.push(updates.placeName);
  }
  if (updates.audioUri !== undefined) {
    fields.push('audio_uri = ?');
    values.push(updates.audioUri);
    nextAudioUri = updates.audioUri;
    shouldRecomputeKind = true;
  }
  if (updates.memoryKind !== undefined) {
    fields.push('memory_kind = ?');
    values.push(updates.memoryKind);
    shouldRecomputeKind = false;
  }

  if (shouldRecomputeKind) {
    const current = await getMemoryById(memoryId);
    if (current) {
      const resolvedKind = getMemoryKind({
        note: nextNote !== undefined ? nextNote : current.note,
        audioUri: nextAudioUri !== undefined ? nextAudioUri : current.audioUri,
        memoryKind: current.memoryKind,
      });
      fields.push('memory_kind = ?');
      values.push(resolvedKind);
    }
  }

  if (fields.length === 0) {
    return;
  }

  values.push(memoryId);
  await db.runAsync(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteMemory(memoryId: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM memories WHERE id = ?', [memoryId]);
}

export async function getMemoryById(memoryId: string): Promise<Memory | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM memories WHERE id = ?', [memoryId]);
  return row ? mapMemoryRow(row) : null;
}

export async function getAllPlaces(): Promise<PlaceRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM places ORDER BY visit_count DESC'
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    visitCount: row.visit_count,
    lastVisited: row.last_visited,
    placeType: row.place_type,
  }));
}

export async function getMemoriesForPlace(placeName: string): Promise<Memory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM memories WHERE place_name = ? ORDER BY timestamp DESC',
    [placeName]
  );
  return rows.map(mapMemoryRow);
}

export async function getOnThisDayMemories(daysAgo: number): Promise<Memory[]> {
  const db = await getDatabase();
  const { start: windowStart, end: windowEnd } = getDaysAgoRange(daysAgo);

  const rows = await db.getAllAsync<any>(
    `SELECT *
     FROM memories
     WHERE timestamp >= ? AND timestamp <= ?
     ORDER BY importance_score DESC, timestamp DESC
     LIMIT 3`,
    [windowStart.getTime(), windowEnd.getTime()]
  );

  return rows.map(mapMemoryRow);
}

export async function saveOnThisDayCaption(memoryId: string, caption: string) {
  const db = await getDatabase();
  await db.runAsync('UPDATE memories SET otd_caption = ? WHERE id = ?', [caption, memoryId]);
}

export async function searchMemories(query: string): Promise<Memory[]> {
  const db = await getDatabase();
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const likeQuery = `%${trimmed}%`;
  const rows = await db.getAllAsync<any>(
    `SELECT *
     FROM memories
     WHERE place_name LIKE ? OR COALESCE(note, '') LIKE ?
     ORDER BY timestamp DESC
     LIMIT 50`,
    [likeQuery, likeQuery]
  );

  return rows.map(mapMemoryRow);
}

export async function getMemoryCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM memories');
  return row?.count || 0;
}

export async function getPlaceCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM places');
  return row?.count || 0;
}

export async function getDayStreak(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ day: string }>(
    `SELECT DISTINCT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch', 'localtime') as day
     FROM memories
     ORDER BY day DESC`
  );

  const daySet = new Set(rows.map((row) => row.day));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const year = cursor.getFullYear();
    const month = `${cursor.getMonth() + 1}`.padStart(2, '0');
    const day = `${cursor.getDate()}`.padStart(2, '0');
    const key = `${year}-${month}-${day}`;

    if (!daySet.has(key)) {
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export async function getDataSummary(): Promise<{ totalMemories: number; totalPlaces: number }> {
  const db = await getDatabase();
  const memoryRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM memories'
  );
  const placeRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM places'
  );

  return {
    totalMemories: memoryRow?.count || 0,
    totalPlaces: placeRow?.count || 0,
  };
}

export type PlaceRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  visitCount: number;
  lastVisited: number;
  placeType: string;
};
