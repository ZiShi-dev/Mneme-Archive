import {
  buildDownloadId,
  isChapterDownloaded,
  normalizeDownloads,
} from "./downloadsModel.js";
import { isOfflineMangaChapter } from "./offlineChapterStore.js";

const DEFAULT_PAGE_BYTES = 180 * 1024;
const DEFAULT_CHAPTER_BYTES = 12 * DEFAULT_PAGE_BYTES;
const STORAGE_OVERHEAD_RATIO = 1.12;

function buildPeekOptions(sourceId, chapter, manga) {
  return {
    contentApi: chapter?.contentApi,
    language: chapter?.preferredAudioLanguage || manga.preferredAudioLanguage || "",
    seriesUrl: sourceId === "novelsparadise" ? manga.url : "",
  };
}

function findDownloadItem(store, sourceId, seriesUrl) {
  return store.items.find((entry) => entry.id === buildDownloadId(sourceId, seriesUrl)) || null;
}

function resolveAverageChapterBytes(store, sourceId, seriesUrl) {
  const seriesSizes = (findDownloadItem(store, sourceId, seriesUrl)?.chapters || [])
    .filter((chapter) => chapter.status === "complete" && chapter.sizeBytes > 0)
    .map((chapter) => chapter.sizeBytes);
  if (seriesSizes.length) {
    return Math.round(seriesSizes.reduce((sum, size) => sum + size, 0) / seriesSizes.length);
  }

  const globalSizes = store.items
    .filter((entry) => entry.mediaType === "manga")
    .flatMap((entry) => entry.chapters)
    .filter((chapter) => chapter.status === "complete" && chapter.sizeBytes > 0)
    .map((chapter) => chapter.sizeBytes);
  if (globalSizes.length) {
    return Math.round(globalSizes.reduce((sum, size) => sum + size, 0) / globalSizes.length);
  }

  return DEFAULT_CHAPTER_BYTES;
}

function estimateMangaPayloadBytes(data) {
  if (!isOfflineMangaChapter(data)) return DEFAULT_CHAPTER_BYTES;
  const pages = data.pages.length;
  const stored = new TextEncoder().encode(JSON.stringify(data)).byteLength;
  return Math.max(stored, pages * DEFAULT_PAGE_BYTES);
}

function estimateSingleChapter(sourceId, chapter, manga, store, peekChapter) {
  if (isChapterDownloaded(store, sourceId, manga.url, chapter.url)) {
    return { bytes: 0, precise: true, alreadySaved: true };
  }

  const stored = findDownloadItem(store, sourceId, manga.url)?.chapters
    ?.find((entry) => entry.url === chapter.url);
  if (stored?.sizeBytes > 0) {
    return { bytes: stored.sizeBytes, precise: true, alreadySaved: false };
  }

  if (peekChapter) {
    const opts = buildPeekOptions(sourceId, chapter, manga);
    const cached = peekChapter(sourceId, chapter.url, opts);
    if (isOfflineMangaChapter(cached)) {
      return { bytes: estimateMangaPayloadBytes(cached), precise: true, alreadySaved: false };
    }
  }

  return {
    bytes: resolveAverageChapterBytes(store, sourceId, manga.url),
    precise: false,
    alreadySaved: false,
  };
}

export function estimateMangaDownloadBatch(sourceId, chapters, manga, rawDownloads, { peekChapter } = {}) {
  const store = normalizeDownloads(rawDownloads);
  let dataBytes = 0;
  let pendingCount = 0;
  let preciseCount = 0;
  let alreadySavedCount = 0;

  for (const chapter of chapters) {
    const estimate = estimateSingleChapter(sourceId, chapter, manga, store, peekChapter);
    if (estimate.alreadySaved) {
      alreadySavedCount += 1;
      continue;
    }
    dataBytes += estimate.bytes;
    pendingCount += 1;
    if (estimate.precise) preciseCount += 1;
  }

  const storageBytes = Math.round(dataBytes * STORAGE_OVERHEAD_RATIO);

  return {
    dataBytes,
    storageBytes,
    pendingCount,
    alreadySavedCount,
    totalCount: chapters.length,
    precise: pendingCount > 0 && preciseCount === pendingCount,
  };
}
