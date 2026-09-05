import { fetchSourceChapter } from "../../features/sources/sourceApi.js";
import { buildChapterFetchOptions } from "../reading/readerChapterCache.js";
import { isAzoraChapterBlocked } from "../media/chapterLock.js";
import { kvGet, kvSet } from "../storage/initStorage.js";
import {
  DOWNLOADS_STORAGE_KEY,
  EMPTY_DOWNLOADS,
  buildDownloadId,
  normalizeDownloads,
  upsertDownloadChapter,
} from "./downloadsModel.js";
import {
  buildOfflineChapterKey,
  deleteOfflineChaptersForDownload,
  estimateChapterBytes,
  getOfflineChapterByRefs,
  isOfflineNovelChapter,
  saveOfflineChapter,
} from "./offlineChapterStore.js";

const activeBatches = new Map();

function isDownloadableNovelChapter(sourceId, chapter) {
  if (!chapter?.url) return false;
  if (isAzoraChapterBlocked(sourceId, chapter)) return false;
  return !chapter.locked;
}

function buildItemMeta(item) {
  return {
    sourceId: item.sourceId,
    title: item.title,
    cover: item.cover,
    seriesUrl: item.url,
    mediaType: "novel",
  };
}

async function readDownloadsStore() {
  return normalizeDownloads(await kvGet(DOWNLOADS_STORAGE_KEY, EMPTY_DOWNLOADS));
}

async function writeDownloadsStore(store) {
  await kvSet(DOWNLOADS_STORAGE_KEY, normalizeDownloads(store));
}

export async function isNovelChapterOffline(sourceId, chapter, manga = {}) {
  const data = await getOfflineChapterByRefs(sourceId, chapter, manga);
  return Boolean(data);
}

export async function downloadNovelChapter(item, chapter, { onStoreUpdate } = {}) {
  if (!isDownloadableNovelChapter(item.sourceId, chapter)) {
    throw new Error("chapter_locked");
  }
  const manga = { ...item, url: item.url || item.seriesUrl };
  const opts = buildChapterFetchOptions(item.sourceId, chapter, manga);
  const downloadId = buildDownloadId(item.sourceId, manga.url);
  const cacheKey = await buildOfflineChapterKey(item.sourceId, chapter.url, opts);

  let store = await readDownloadsStore();
  store = upsertDownloadChapter(store, buildItemMeta(item), chapter, {
    status: "downloading",
    progress: 5,
    sizeBytes: 0,
  });
  await writeDownloadsStore(store);
  onStoreUpdate?.(store);

  try {
    const result = await fetchSourceChapter(item.sourceId, chapter.url, opts);
    if (!isOfflineNovelChapter(result)) {
      throw new Error("not_novel");
    }
    const payload = { ...result, url: chapter.url };
    const sizeBytes = estimateChapterBytes(payload);
    await saveOfflineChapter(cacheKey, downloadId, payload);

    store = await readDownloadsStore();
    store = upsertDownloadChapter(store, buildItemMeta(item), chapter, {
      status: "complete",
      progress: 100,
      sizeBytes,
      downloadedAt: Date.now(),
    });
    await writeDownloadsStore(store);
    onStoreUpdate?.(store);
    return store;
  } catch (error) {
    store = await readDownloadsStore();
    store = upsertDownloadChapter(store, buildItemMeta(item), chapter, {
      status: "failed",
      progress: 0,
      sizeBytes: 0,
    });
    await writeDownloadsStore(store);
    onStoreUpdate?.(store);
    throw error;
  }
}

export async function downloadAllNovelChapters(item, chapters, { onProgress, onStoreUpdate } = {}) {
  const manga = { ...item, url: item.url || item.seriesUrl };
  const downloadId = buildDownloadId(item.sourceId, manga.url);
  const batchId = `${downloadId}:${Date.now()}`;
  const controller = { cancelled: false };
  activeBatches.set(batchId, controller);

  const queue = chapters.filter((chapter) => isDownloadableNovelChapter(item.sourceId, chapter));
  let completed = 0;

  try {
    for (const chapter of queue) {
      if (controller.cancelled) break;
      await downloadNovelChapter(item, chapter, { onStoreUpdate });
      completed += 1;
      onProgress?.({ completed, total: queue.length, chapter });
    }
    return { completed, total: queue.length, cancelled: controller.cancelled };
  } finally {
    activeBatches.delete(batchId);
  }
}

export function cancelNovelDownloadBatch(downloadId) {
  for (const [key, controller] of activeBatches.entries()) {
    if (key.startsWith(`${downloadId}:`)) controller.cancelled = true;
  }
}

export async function removeNovelDownload(item) {
  const downloadId = buildDownloadId(item.sourceId, item.seriesUrl || item.url);
  await deleteOfflineChaptersForDownload(downloadId);
}

export async function loadOfflinePrefetch(item, chapter) {
  return getOfflineChapterByRefs(item.sourceId, chapter, item);
}
