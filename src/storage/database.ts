import * as SQLite from 'expo-sqlite';
import { Memory, Place } from '../models/Memory';

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
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_place ON memories(place_name);
  `);

  const memoryColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(memories)');
  const hasOnThisDayCaption = memoryColumns.some((column) => column.name === 'on_this_day_caption');
  if (!hasOnThisDayCaption) {
    await db.execAsync('ALTER TABLE memories ADD COLUMN on_this_day_caption TEXT;');
  }

  return db;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayRange(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  return { start, end };
}

export async function insertMemory(memory: Memory): Promise<boolean> {
  const db = await getDatabase();

  const shouldDeduplicate = !memory.note && memory.placeType !== 'manual';

  if (shouldDeduplicate) {
    // Deduplication: skip if we have a memory within 200m in the last 10 minutes
    const tenMinutesAgo = memory.timestamp - 10 * 60 * 1000;
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
      if (dist < 200) {
        console.log('Duplicate memory skipped - still at same location');
        return false;
      }
    }
  }

  await db.runAsync(
    `INSERT OR REPLACE INTO memories
     (id, timestamp, latitude, longitude, place_name, place_type, activity_type, duration_minutes, people_ids, note, importance_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ]
  );

  await upsertPlace(memory);
  await db.runAsync('DELETE FROM digests WHERE date = ?', [getLocalDateKey(memory.timestamp)]);
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
    if (dist < 150) {
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
  return rows.map((row) => ({
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
    onThisDayCaption: row.on_this_day_caption,
  }));
}

export async function getMemoriesForDate(date: string): Promise<Memory[]> {
  const db = await getDatabase();
  const { start, end } = getDayRange(date);

  const rows = await db.getAllAsync<any>(
    'SELECT * FROM memories WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC',
    [start.getTime(), end.getTime()]
  );

  return rows.map((row) => ({
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
    onThisDayCaption: row.on_this_day_caption,
  }));
}

export async function saveDigest(date: string, summary: string) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO digests (id, date, summary, created_at) VALUES (?, ?, ?, ?)`,
    [`digest-${date}`, date, summary, Date.now()]
  );
}

export async function getDigestForDate(date: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT summary FROM digests WHERE date = ?', [date]);
  return row?.summary || null;
}

export async function clearAllMemories() {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM memories; DELETE FROM places; DELETE FROM digests;');
}

export async function deleteDigestForDate(date: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM digests WHERE date = ?', [date]);
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
  return rows.map((row) => ({
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
    onThisDayCaption: row.on_this_day_caption,
  }));
}

export async function getOnThisDayMemories(daysAgo: number): Promise<Memory[]> {
  const db = await getDatabase();
  const target = new Date();
  target.setDate(target.getDate() - daysAgo);

  const windowStart = new Date(target.getTime() - 12 * 60 * 60 * 1000);
  const windowEnd = new Date(target.getTime() + 12 * 60 * 60 * 1000);

  const rows = await db.getAllAsync<any>(
    `SELECT *
     FROM memories
     WHERE timestamp >= ? AND timestamp <= ?
     ORDER BY importance_score DESC, timestamp DESC
     LIMIT 3`,
    [windowStart.getTime(), windowEnd.getTime()]
  );

  return rows.map((row) => ({
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
    onThisDayCaption: row.on_this_day_caption,
  }));
}

export async function saveOnThisDayCaption(memoryId: string, caption: string) {
  const db = await getDatabase();
  await db.runAsync('UPDATE memories SET on_this_day_caption = ? WHERE id = ?', [
    caption,
    memoryId,
  ]);
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
