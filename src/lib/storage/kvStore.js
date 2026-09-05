import { isNativeStorage, dbQuery, dbRun } from "./database";
import {
  MAX_KV_VALUE_BYTES,
  CHAPTER_PROGRESS_PREFIX,
  STORAGE_META_MIGRATED,
  STORAGE_META_CHAPTER_LOG_BACKFILL,
} from "./constants";
import {
  assertAllowedKey,
  isAllowedStorageKey,
  safeJsonStringify,
} from "./security";

const memoryCache = new Map();
let ready = false;

export function resetKvStore() {
  memoryCache.clear();
  ready = false;
}

function readWebRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeWebRaw(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Échec silencieux — quota dépassé ou mode privé.
  }
}

function removeWebRaw(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignorer.
  }
}

async function readNativeRaw(key) {
  const result = await dbQuery("SELECT value FROM kv_store WHERE key = ? LIMIT 1", [key]);
  return result?.values?.[0]?.value ?? null;
}

async function writeNativeRaw(key, value) {
  const now = Date.now();
  await dbRun(
    "INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [key, value, now],
  );
}

async function removeNativeRaw(key) {
  await dbRun("DELETE FROM kv_store WHERE key = ?", [key]);
}

async function yieldToMain() {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

const NATIVE_KV_BATCH_SIZE = 40;
const HYDRATE_DELAY_MS = 120;

const BOOT_PRIORITY_KEYS = [
  STORAGE_META_MIGRATED,
  STORAGE_META_CHAPTER_LOG_BACKFILL,
  "living-archive:locale",
  "living-archive:appearance",
  "living-archive:typeface",
  "living-archive:onboarding-complete",
  "living-archive:active-source",
  "living-archive:v5:source-preferences",
  "living-archive:ink-mode",
  "living-archive:reader-preferences",
  "living-archive:follow-preferences",
  "living-archive:catalog-state",
  "living-archive:catalog-snapshots",
];

async function loadNativeCriticalKeys() {
  if (!BOOT_PRIORITY_KEYS.length) return;
  const placeholders = BOOT_PRIORITY_KEYS.map(() => "?").join(", ");
  const result = await dbQuery(
    `SELECT key, value FROM kv_store WHERE key IN (${placeholders})`,
    BOOT_PRIORITY_KEYS,
  );
  cacheNativeRows(result?.values || []);
}

async function loadNativeRowsBatched(whereClause, params, onBatch) {
  let offset = 0;
  while (true) {
    const result = await dbQuery(
      `SELECT key, value FROM kv_store ${whereClause} ORDER BY key LIMIT ? OFFSET ?`,
      [...params, NATIVE_KV_BATCH_SIZE, offset],
    );
    const rows = result?.values || [];
    if (!rows.length) break;
    onBatch(rows);
    offset += rows.length;
    await yieldToMain();
  }
}

function cacheNativeRows(rows) {
  rows.forEach((row) => {
    if (row?.key) memoryCache.set(row.key, row.value);
  });
}

const BOOT_MIRROR_KEYS = new Set([
  "living-archive:appearance",
  "living-archive:typeface",
  "living-archive:locale",
  "living-archive:ink-mode",
]);

function mirrorBootKeysToLocalStorage() {
  if (typeof localStorage === "undefined") return;
  for (const key of BOOT_MIRROR_KEYS) {
    if (!memoryCache.has(key)) continue;
    writeWebRaw(key, memoryCache.get(key));
  }
}

async function loadNativeBootCache() {
  await loadNativeCriticalKeys();
  mirrorBootKeysToLocalStorage();
}

function scheduleNativeHydration() {
  setTimeout(() => {
    void hydrateNativeKvStore();
  }, HYDRATE_DELAY_MS);
}

async function loadNativeChapterProgressCache() {
  await loadNativeRowsBatched(
    "WHERE key LIKE ?",
    [`${CHAPTER_PROGRESS_PREFIX}%`],
    cacheNativeRows,
  );
}

async function hydrateNativeKvStore() {
  try {
    await loadNativeRowsBatched(
      "WHERE key NOT LIKE ?",
      [`${CHAPTER_PROGRESS_PREFIX}%`],
      cacheNativeRows,
    );
    await loadNativeChapterProgressCache();
    const { migrateChapterReadLogBackfill } = await import("./migrateChapterReadLog.js");
    await migrateChapterReadLogBackfill();
  } catch {
    // L'hydratation complète peut attendre le prochain démarrage.
  }
}

function loadAllWebIntoMemory() {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && isAllowedStorageKey(key)) {
      memoryCache.set(key, readWebRaw(key));
    }
  }
}

export function kvHasSync(key) {
  return memoryCache.has(key);
}

function parseStoredValue(raw, fallback) {
  if (raw == null) return fallback;
  if (typeof fallback === "string") return raw;
  if (typeof fallback === "number") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    const bytes = new TextEncoder().encode(raw).byteLength;
    if (bytes > MAX_KV_VALUE_BYTES) return fallback;
    return parsed;
  } catch {
    // Valeurs texte legacy (ex. living-archive:appearance = sakura).
    if (typeof raw === "string" && raw.length > 0 && raw.length < 256) return raw;
    return fallback;
  }
}

export function kvGetSync(key, fallback) {
  if (!memoryCache.has(key)) return fallback;
  const raw = memoryCache.get(key);
  return parseStoredValue(raw, fallback);
}

export function kvGetStringSync(key, fallback = "") {
  if (!memoryCache.has(key)) return fallback;
  return memoryCache.get(key) ?? fallback;
}

/** Écriture synchrone avec validation de clé et mise à jour du cache mémoire. */
export function persistStorageString(key, value) {
  assertAllowedKey(key);
  const raw = String(value);
  memoryCache.set(key, raw);
  if (isNativeStorage()) {
    void writeNativeRaw(key, raw);
    if (BOOT_MIRROR_KEYS.has(key)) writeWebRaw(key, raw);
  } else {
    writeWebRaw(key, raw);
  }
}

export async function kvGet(key, fallback) {
  assertAllowedKey(key);
  if (memoryCache.has(key)) {
    return parseStoredValue(memoryCache.get(key), fallback);
  }
  const raw = isNativeStorage() ? await readNativeRaw(key) : readWebRaw(key);
  if (raw == null) return fallback;
  memoryCache.set(key, raw);
  return parseStoredValue(raw, fallback);
}

export async function kvSet(key, value) {
  assertAllowedKey(key);
  const raw = typeof value === "string" ? value : safeJsonStringify(value);
  memoryCache.set(key, raw);
  if (isNativeStorage()) {
    await writeNativeRaw(key, raw);
  } else {
    writeWebRaw(key, raw);
  }
}

export function kvSetString(key, value) {
  assertAllowedKey(key);
  const raw = String(value);
  memoryCache.set(key, raw);
  if (isNativeStorage()) {
    void writeNativeRaw(key, raw);
  } else {
    writeWebRaw(key, raw);
  }
}

export async function kvRemove(key) {
  assertAllowedKey(key);
  memoryCache.delete(key);
  if (isNativeStorage()) {
    await removeNativeRaw(key);
  } else {
    removeWebRaw(key);
  }
}

export async function initKvStore() {
  if (ready) return;
  memoryCache.clear();
  if (isNativeStorage()) {
    await loadNativeBootCache();
    ready = true;
    scheduleNativeHydration();
    return;
  }
  loadAllWebIntoMemory();
  ready = true;
}

export function isKvStoreReady() {
  return ready;
}

export function listKeysByPrefix(prefix) {
  return [...memoryCache.keys()].filter((key) => key.startsWith(prefix));
}

export function listAllStoredKeys() {
  return [...memoryCache.keys()].filter(isAllowedStorageKey);
}

export async function clearAllKvEntries() {
  const keys = listAllStoredKeys();
  if (isNativeStorage()) {
    await dbRun("DELETE FROM kv_store");
  } else {
    for (const key of keys) {
      removeWebRaw(key);
    }
  }
  memoryCache.clear();
}

export function listChapterProgressEntries() {
  const prefix = "living-archive:chapter-progress:";
  return listKeysByPrefix(prefix)
    .map((key) => ({
      key,
      progress: Math.min(100, Math.max(0, Number(memoryCache.get(key)) || 0)),
    }))
    .filter((entry) => entry.progress > 0);
}
