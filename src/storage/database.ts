import * as SQLite from 'expo-sqlite';

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

    CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_place ON memories(place_name);
  `);

  return db;
}

export async function insertMemory(memory: import('../models/Memory').Memory) {
  const db = await getDatabase();
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
}

export async function getAllMemories(): Promise<import('../models/Memory').Memory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM memories ORDER BY timestamp DESC'
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
  }));
}
