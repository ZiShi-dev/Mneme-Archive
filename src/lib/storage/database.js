import { Capacitor } from "@capacitor/core";
import { isChromebookApp } from "../../config/appFlavor";
import { DB_NAME, DB_VERSION } from "./constants";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS image_cache (
  cache_key TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL,
  remote_url TEXT NOT NULL,
  local_path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_image_cache_fetched ON image_cache(fetched_at);
`;

let sqliteConnection = null;
let db = null;
let initPromise = null;

export function isNativeStorage() {
  return Capacitor.isNativePlatform() && !isChromebookApp;
}

async function runMigrations(connection) {
  await connection.execute(SCHEMA_SQL);
  await connection.run(
    "INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)",
    ["schema_version", String(DB_VERSION)],
  );
}

async function createDatabaseConnection(connection, { encrypted, mode }) {
  const created = await connection.createConnection(DB_NAME, encrypted, mode, DB_VERSION, false);
  await created.open();
  return created;
}

export async function openDatabase() {
  if (!isNativeStorage()) return null;
  if (db) return db;
  if (!initPromise) {
    initPromise = (async () => {
      const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");
      sqliteConnection = new SQLiteConnection(CapacitorSQLite);
      const consistency = await sqliteConnection.checkConnectionsConsistency();
      const isConn = (await sqliteConnection.isConnection(DB_NAME, false)).result;
      const { resolveDatabaseOpenOptions } = await import("./dbEncryption.js");
      const openOptions = await resolveDatabaseOpenOptions(sqliteConnection, DB_NAME);

      if (consistency.result && isConn) {
        db = await sqliteConnection.retrieveConnection(DB_NAME, false);
        await db.open();
      } else {
        db = await createDatabaseConnection(sqliteConnection, openOptions);
      }

      await runMigrations(db);
      return db;
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

export async function dbRun(query, params = []) {
  const connection = await openDatabase();
  if (!connection) return null;
  return connection.run(query, params);
}

export async function dbQuery(query, params = []) {
  const connection = await openDatabase();
  if (!connection) return { values: [] };
  return connection.query(query, params);
}

export async function dbGetMeta(key) {
  const result = await dbQuery("SELECT value FROM app_meta WHERE key = ? LIMIT 1", [key]);
  return result?.values?.[0]?.value ?? null;
}

export async function dbSetMeta(key, value) {
  await dbRun(
    "INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}
