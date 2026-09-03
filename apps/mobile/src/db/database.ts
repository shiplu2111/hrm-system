import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'hrm-mobile.db';

let database: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!database) {
    database = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await migrate(database);
  }
  return database;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      local_id TEXT NOT NULL UNIQUE,
      employee_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      timestamp_device TEXT NOT NULL,
      gps_lat REAL,
      gps_lng REAL,
      geofence_ok INTEGER,
      offline_duration_seconds INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sync_queue_status_created
      ON sync_queue (status, created_at);

    CREATE TABLE IF NOT EXISTS app_session (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permission_consent (
      permission TEXT PRIMARY KEY NOT NULL,
      granted INTEGER,
      updated_at TEXT NOT NULL
    );
  `);
}
