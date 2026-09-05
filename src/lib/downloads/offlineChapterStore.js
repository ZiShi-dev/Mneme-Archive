import { buildChapterFetchOptions } from "../reading/readerChapterCache.js";
import { sha256Hex } from "../storage/security.js";

const IDB_NAME = "living_archive_offline";
const IDB_STORE = "chapters";
const IDB_VERSION = 1;

function openOfflineDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IDB_STORE)) {
        const store = database.createObjectStore(IDB_STORE, { keyPath: "cacheKey" });
        store.createIndex("downloadId", "downloadId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function buildOfflineChapterKey(sourceId, chapterUrl, options = {}) {
  const raw = `${sourceId}|${chapterUrl}|${options.contentApi || ""}|${options.seriesUrl || ""}|${options.language || ""}`;
  return sha256Hex(raw);
}

export function estimateChapterBytes(data) {
  return new TextEncoder().encode(JSON.stringify(data || {})).byteLength;
}

export function isOfflineNovelChapter(data) {
  return data?.kind === "novel" && Array.isArray(data.paragraphs) && data.paragraphs.length > 0;
}

export async function saveOfflineChapter(cacheKey, downloadId, payload) {
  const database = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IDB_STORE, "readwrite");
    const store = transaction.objectStore(IDB_STORE);
    const request = store.put({
      cacheKey,
      downloadId,
      savedAt: Date.now(),
      data: payload,
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineChapter(cacheKey) {
  if (!cacheKey) return null;
  try {
    const database = await openOfflineDb();
    const entry = await new Promise((resolve, reject) => {
      const transaction = database.transaction(IDB_STORE, "readonly");
      const store = transaction.objectStore(IDB_STORE);
      const request = store.get(cacheKey);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    const data = entry?.data;
    return isOfflineNovelChapter(data) ? data : null;
  } catch {
    return null;
  }
}

export async function getOfflineChapterByRefs(sourceId, chapter, manga = {}) {
  const opts = buildChapterFetchOptions(sourceId, chapter, manga);
  const cacheKey = await buildOfflineChapterKey(sourceId, chapter.url, opts);
  const data = await getOfflineChapter(cacheKey);
  if (!data) return null;
  return { ...data, url: chapter.url };
}

export async function deleteOfflineChapter(cacheKey) {
  if (!cacheKey) return;
  try {
    const database = await openOfflineDb();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(IDB_STORE, "readwrite");
      const store = transaction.objectStore(IDB_STORE);
      const request = store.delete(cacheKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // ignore
  }
}

export async function deleteOfflineChaptersForDownload(downloadId) {
  if (!downloadId) return;
  try {
    const database = await openOfflineDb();
    const keys = await new Promise((resolve, reject) => {
      const transaction = database.transaction(IDB_STORE, "readonly");
      const store = transaction.objectStore(IDB_STORE);
      const index = store.index("downloadId");
      const request = index.getAllKeys(downloadId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    if (!keys.length) return;
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(IDB_STORE, "readwrite");
      const store = transaction.objectStore(IDB_STORE);
      for (const key of keys) store.delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // ignore
  }
}
