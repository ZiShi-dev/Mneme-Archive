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

const DB_OPEN_TIMEOUT_MS = 12000;
const FRESH_ENCRYPTED_OPTIONS = { encrypted: true, mode: "secret" };

let sqliteConnection = null;
let db = null;
let initPromise = null;

export function isNativeStorage() {
  return Capacitor.isNativePlatform() && !isChromebookApp;
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Storage timeout: ${label}`));
    }, ms);
    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function resetDatabaseState() {
  initPromise = null;
  db = null;
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

async function closeDatabaseConnection(connection) {
  try {
    const isConn = (await connection.isConnection(DB_NAME, false)).result;
    if (!isConn) return;
    await connection.closeConnection(DB_NAME, false);
  } catch {
    // Connexion déjà fermée ou plugin indisponible.
  }
}

async function resetDatabaseFiles(connection) {
  await closeDatabaseConnection(connection);
  try {
    await connection.deleteDatabase(DB_NAME);
  } catch {
    // La base peut déjà être absente.
  }
  db = null;
}

async function openFreshConnection(connection, openOptions) {
  await closeDatabaseConnection(connection);
  return createDatabaseConnection(connection, openOptions);
}

async function openDatabaseInternal() {
  const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");
  sqliteConnection = new SQLiteConnection(CapacitorSQLite);
  const { resolveDatabaseOpenOptions } = await import("./dbEncryption.js");
  const openOptions = await withTimeout(
    resolveDatabaseOpenOptions(sqliteConnection, DB_NAME),
    DB_OPEN_TIMEOUT_MS,
    "resolveDatabaseOpenOptions",
  );

  try {
    db = await withTimeout(
      openFreshConnection(sqliteConnection, openOptions),
      DB_OPEN_TIMEOUT_MS,
      "openDatabase",
    );
  } catch (primaryError) {
    await resetDatabaseFiles(sqliteConnection);
    db = await withTimeout(
      createDatabaseConnection(sqliteConnection, FRESH_ENCRYPTED_OPTIONS),
      DB_OPEN_TIMEOUT_MS,
      "openDatabaseRecovery",
    );
  }

  await runMigrations(db);
  return db;
}

export async function openDatabase() {
  if (!isNativeStorage()) return null;
  if (db) return db;
  if (!initPromise) {
    initPromise = withTimeout(
      openDatabaseInternal(),
      DB_OPEN_TIMEOUT_MS * 2,
      "openDatabaseTotal",
    ).catch((error) => {
      resetDatabaseState();
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
