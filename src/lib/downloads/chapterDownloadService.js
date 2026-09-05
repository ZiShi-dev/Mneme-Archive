import { resolveBookmarkType } from "../../features/sources/contentTypes.js";
import {
  downloadAllMangaChapters,
  downloadMangaChapter,
  loadOfflineMangaPrefetch,
  removeMangaDownload,
} from "./mangaDownloadService.js";
import {
  downloadAllNovelChapters,
  downloadNovelChapter,
  loadOfflinePrefetch as loadOfflineNovelPrefetch,
  removeNovelDownload,
} from "./novelDownloadService.js";
import { estimateMangaDownloadBatch } from "./estimateMangaDownloadSizeWithCache.js";
import { estimateNovelDownloadBatch } from "./estimateNovelDownloadSizeWithCache.js";

export function resolveDownloadMediaType(item) {
  const type = String(item?.mediaType || resolveBookmarkType(item) || "manga").toLowerCase();
  return type === "novel" ? "novel" : "manga";
}

export function estimateDownloadBatch(sourceId, chapters, item, rawDownloads) {
  const mediaType = resolveDownloadMediaType(item);
  if (mediaType === "novel") {
    return estimateNovelDownloadBatch(sourceId, chapters, item, rawDownloads);
  }
  return estimateMangaDownloadBatch(sourceId, chapters, item, rawDownloads);
}

export async function downloadChapter(item, chapter, options = {}) {
  if (resolveDownloadMediaType(item) === "novel") {
    return downloadNovelChapter(item, chapter, options);
  }
  return downloadMangaChapter(item, chapter, options);
}

export async function downloadAllChapters(item, chapters, options = {}) {
  if (resolveDownloadMediaType(item) === "novel") {
    return downloadAllNovelChapters(item, chapters, options);
  }
  return downloadAllMangaChapters(item, chapters, options);
}

export async function removeOfflineDownload(item) {
  if (resolveDownloadMediaType(item) === "novel") {
    return removeNovelDownload(item);
  }
  return removeMangaDownload(item);
}

export async function loadOfflinePrefetch(item, chapter) {
  if (resolveDownloadMediaType(item) === "novel") {
    return loadOfflineNovelPrefetch(item, chapter);
  }
  return loadOfflineMangaPrefetch(item, chapter);
}
