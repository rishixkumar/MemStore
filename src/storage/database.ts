import * as SQLite from 'expo-sqlite';
import { Memory, Place } from '../models/Memory';
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

    CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_place ON memories(place_name);
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

function inferMemoryKind(memory: Pick<Memory, 'memoryKind' | 'audioUri' | 'note'>) {
  return memory.memoryKind || (memory.audioUri ? 'voice' : memory.note ? 'note' : 'passive');
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
    memoryKind: inferMemoryKind({
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
        console.log('Duplicate memory skipped - still at same location');
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
      inferMemoryKind(memory),
    ]
  );

  await upsertPlace(memory);
  await db.runAsync('DELETE FROM digests WHERE date = ?', [toLocalDateKey(memory.timestamp)]);
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

export async function getMemoriesForDate(date: string): Promise<Memory[]> {
  const db = await getDatabase();
  const { start, end } = getDayRangeForDateKey(date);

  const rows = await db.getAllAsync<any>(
    'SELECT * FROM memories WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC',
    [start.getTime(), end.getTime()]
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

export async function getDigestForDate(
  date: string
): Promise<{ summary: string; provider: string } | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT summary, provider FROM digests WHERE date = ?', [
    date,
  ]);
  return row ? { summary: row.summary, provider: row.provider || 'fallback' } : null;
}

export async function clearAllMemories() {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM memories; DELETE FROM places; DELETE FROM digests;');
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

  if (updates.note !== undefined) {
    fields.push('note = ?');
    values.push(updates.note);
  }
  if (updates.placeName !== undefined) {
    fields.push('place_name = ?');
    values.push(updates.placeName);
  }
  if (updates.audioUri !== undefined) {
    fields.push('audio_uri = ?');
    values.push(updates.audioUri);
  }
  if (updates.memoryKind !== undefined) {
    fields.push('memory_kind = ?');
    values.push(updates.memoryKind);
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
