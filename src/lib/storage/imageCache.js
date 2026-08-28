import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_CACHE_DIR,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_CACHE_BYTES,
  MAX_IMAGE_CACHE_ENTRIES,
} from "./constants";
import { dbQuery, dbRun, isNativeStorage } from "./database";
import {
  extensionForContentType,
  isAllowedImageUrl,
  sha256Hex,
} from "./security";
import { t } from "../../i18n/runtime.js";

const memoryObjectUrls = new Map();
const IDB_NAME = "living_archive_images";
const IDB_STORE = "images";

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function revokeObjectUrl(cacheKey) {
  const existing = memoryObjectUrls.get(cacheKey);
  if (existing?.startsWith("blob:")) {
    URL.revokeObjectURL(existing);
  }
  memoryObjectUrls.delete(cacheKey);
}

function openImageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IDB_STORE)) {
        database.createObjectStore(IDB_STORE, { keyPath: "cacheKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readWebCacheEntry(cacheKey) {
  const database = await openImageDb();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IDB_STORE, "readonly");
    const store = transaction.objectStore(IDB_STORE);
    const request = store.get(cacheKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function writeWebCacheEntry(entry) {
  const database = await openImageDb();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IDB_STORE, "readwrite");
    const store = transaction.objectStore(IDB_STORE);
    const request = store.put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteWebCacheEntry(cacheKey) {
  const database = await openImageDb();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IDB_STORE, "readwrite");
    const store = transaction.objectStore(IDB_STORE);
    const request = store.delete(cacheKey);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function listWebCacheEntries() {
  const database = await openImageDb();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IDB_STORE, "readonly");
    const store = transaction.objectStore(IDB_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function getNativeCacheEntry(cacheKey) {
  const result = await dbQuery(
    "SELECT cache_key, local_path, content_type, size_bytes, fetched_at FROM image_cache WHERE cache_key = ? LIMIT 1",
    [cacheKey],
  );
  return result?.values?.[0] || null;
}

async function insertNativeCacheEntry(entry) {
  await dbRun(
    "INSERT OR REPLACE INTO image_cache (cache_key, source_id, remote_url, local_path, content_type, size_bytes, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      entry.cacheKey,
      entry.sourceId,
      entry.remoteUrl,
      entry.localPath,
      entry.contentType,
      entry.sizeBytes,
      entry.fetchedAt,
    ],
  );
}

async function deleteNativeCacheEntry(cacheKey) {
  await dbRun("DELETE FROM image_cache WHERE cache_key = ?", [cacheKey]);
}

async function listNativeCacheEntries() {
  const result = await dbQuery(
    "SELECT cache_key, local_path, content_type, size_bytes, fetched_at FROM image_cache ORDER BY fetched_at ASC",
  );
  return result?.values || [];
}

async function ensureCacheDirectory() {
  try {
    await Filesystem.mkdir({
      path: IMAGE_CACHE_DIR,
      directory: Directory.Data,
      recursive: true,
    });
  } catch {
    // Le dossier existe déjà.
  }
}

async function nativeDisplayUri(localPath) {
  const { uri } = await Filesystem.getUri({
    path: localPath,
    directory: Directory.Data,
  });
  return Capacitor.convertFileSrc(uri);
}

async function fileExists(localPath) {
  try {
    await Filesystem.stat({ path: localPath, directory: Directory.Data });
    return true;
  } catch {
    return false;
  }
}

async function removeNativeFile(localPath) {
  try {
    await Filesystem.deleteFile({ path: localPath, directory: Directory.Data });
  } catch {
    // Fichier déjà absent.
  }
}

function validateFetchedImage(contentType, sizeBytes) {
  const normalized = (contentType || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(normalized)) {
    throw new Error(t("errors.imageTypeNotAllowed"));
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_IMAGE_BYTES) {
    throw new Error(t("errors.imageSizeNotAllowed"));
  }
  return normalized;
}

async function evictNativeIfNeeded() {
  const entries = await listNativeCacheEntries();
  let totalBytes = entries.reduce((sum, entry) => sum + Number(entry.size_bytes || 0), 0);
  while (entries.length > MAX_IMAGE_CACHE_ENTRIES || totalBytes > MAX_IMAGE_CACHE_BYTES) {
    const oldest = entries.shift();
    if (!oldest) break;
    revokeObjectUrl(oldest.cache_key);
    await deleteNativeCacheEntry(oldest.cache_key);
    await removeNativeFile(oldest.local_path);
    totalBytes -= Number(oldest.size_bytes || 0);
  }
}

async function evictWebIfNeeded() {
  const entries = await listWebCacheEntries();
  entries.sort((a, b) => (a.fetchedAt || 0) - (b.fetchedAt || 0));
  let totalBytes = entries.reduce((sum, entry) => sum + Number(entry.sizeBytes || 0), 0);
  while (entries.length > MAX_IMAGE_CACHE_ENTRIES || totalBytes > MAX_IMAGE_CACHE_BYTES) {
    const oldest = entries.shift();
    if (!oldest) break;
    revokeObjectUrl(oldest.cacheKey);
    await deleteWebCacheEntry(oldest.cacheKey);
    totalBytes -= Number(oldest.sizeBytes || 0);
  }
}

async function readNativeCachedUri(cacheKey, entry) {
  if (!entry || !(await fileExists(entry.local_path))) return null;
  const uri = await nativeDisplayUri(entry.local_path);
  memoryObjectUrls.set(cacheKey, uri);
  return uri;
}

async function readWebCachedUri(cacheKey, entry) {
  if (!entry?.blob) return null;
  const objectUrl = URL.createObjectURL(entry.blob);
  memoryObjectUrls.set(cacheKey, objectUrl);
  return objectUrl;
}

async function writeNativeCache(cacheKey, sourceId, remoteUrl, buffer, contentType) {
  await ensureCacheDirectory();
  const ext = extensionForContentType(contentType);
  const localPath = `${IMAGE_CACHE_DIR}/${cacheKey}${ext}`;
  const base64 = arrayBufferToBase64(buffer);
  await Filesystem.writeFile({
    path: localPath,
    data: base64,
    directory: Directory.Data,
  });
  await insertNativeCacheEntry({
    cacheKey,
    sourceId,
    remoteUrl,
    localPath,
    contentType,
    sizeBytes: buffer.byteLength,
    fetchedAt: Date.now(),
  });
  await evictNativeIfNeeded();
  return nativeDisplayUri(localPath);
}

async function writeWebCache(cacheKey, sourceId, remoteUrl, buffer, contentType) {
  const blob = new Blob([buffer], { type: contentType });
  await writeWebCacheEntry({
    cacheKey,
    sourceId,
    remoteUrl,
    blob,
    contentType,
    sizeBytes: buffer.byteLength,
    fetchedAt: Date.now(),
  });
  await evictWebIfNeeded();
  const objectUrl = URL.createObjectURL(blob);
  memoryObjectUrls.set(cacheKey, objectUrl);
  return objectUrl;
}

export async function resolveCachedImage(sourceId, remoteUrl, fetchImage) {
  if (!isAllowedImageUrl(remoteUrl)) {
    throw new Error(t("errors.imageUrlNotAllowed"));
  }

  const cacheKey = await sha256Hex(`${sourceId}|${remoteUrl}`);
  if (memoryObjectUrls.has(cacheKey)) {
    return memoryObjectUrls.get(cacheKey);
  }

  if (isNativeStorage()) {
    const cached = await getNativeCacheEntry(cacheKey);
    const cachedUri = await readNativeCachedUri(cacheKey, cached);
    if (cachedUri) return cachedUri;
  } else if (typeof indexedDB !== "undefined") {
    const cached = await readWebCacheEntry(cacheKey);
    const cachedUri = await readWebCachedUri(cacheKey, cached);
    if (cachedUri) return cachedUri;
  }

  const fetched = await fetchImage();
  const buffer = fetched.buffer instanceof ArrayBuffer
    ? fetched.buffer
    : fetched.buffer?.buffer?.slice?.(fetched.buffer.byteOffset, fetched.buffer.byteOffset + fetched.buffer.byteLength);
  if (!buffer) throw new Error(t("errors.loadImage"));
  const contentType = validateFetchedImage(fetched.contentType, buffer.byteLength);

  revokeObjectUrl(cacheKey);
  if (isNativeStorage()) {
    return writeNativeCache(cacheKey, sourceId, remoteUrl, buffer, contentType);
  }
  if (typeof indexedDB !== "undefined") {
    return writeWebCache(cacheKey, sourceId, remoteUrl, buffer, contentType);
  }

  const objectUrl = URL.createObjectURL(new Blob([buffer], { type: contentType }));
  memoryObjectUrls.set(cacheKey, objectUrl);
  return objectUrl;
}

export async function clearImageCache() {
  for (const cacheKey of memoryObjectUrls.keys()) {
    revokeObjectUrl(cacheKey);
  }
  if (isNativeStorage()) {
    const entries = await listNativeCacheEntries();
    await Promise.all(entries.map(async (entry) => {
      await deleteNativeCacheEntry(entry.cache_key);
      await removeNativeFile(entry.local_path);
    }));
    return;
  }
  if (typeof indexedDB !== "undefined") {
    const entries = await listWebCacheEntries();
    await Promise.all(entries.map((entry) => deleteWebCacheEntry(entry.cacheKey)));
  }
}
