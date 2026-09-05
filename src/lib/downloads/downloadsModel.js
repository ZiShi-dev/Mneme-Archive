export const DOWNLOADS_STORAGE_KEY = "living-archive:offline-downloads";

const DOWNLOAD_STATUSES = new Set(["queued", "downloading", "complete", "failed", "paused"]);

export const EMPTY_DOWNLOADS = Object.freeze({ version: 1, items: [] });

function normalizeChapter(entry) {
  if (!entry?.url) return null;
  const status = DOWNLOAD_STATUSES.has(entry.status) ? entry.status : "queued";
  return {
    url: String(entry.url),
    number: String(entry.number || ""),
    name: String(entry.name || entry.number || ""),
    status,
    progress: Math.max(0, Math.min(100, Number(entry.progress) || 0)),
    sizeBytes: Math.max(0, Number(entry.sizeBytes) || 0),
    downloadedAt: Number(entry.downloadedAt) || 0,
  };
}

export function normalizeDownloadItem(item) {
  if (!item?.id || !item?.title) return null;
  const chapters = Array.isArray(item.chapters)
    ? item.chapters.map(normalizeChapter).filter(Boolean)
    : [];
  const downloadedBytes = chapters.reduce(
    (sum, chapter) => sum + Math.round((chapter.sizeBytes * chapter.progress) / 100),
    0,
  );
  const totalBytes = Number(item.totalBytes) || chapters.reduce((sum, chapter) => sum + chapter.sizeBytes, 0);
  const status = chapters.length
    ? inferDownloadStatus(chapters)
    : (DOWNLOAD_STATUSES.has(item.status) ? item.status : "queued");
  return {
    id: String(item.id),
    sourceId: String(item.sourceId || ""),
    title: String(item.title || ""),
    cover: String(item.cover || ""),
    seriesUrl: String(item.seriesUrl || item.url || ""),
    mediaType: String(item.mediaType || "manga"),
    status,
    chapters,
    totalBytes,
    downloadedBytes: Number(item.downloadedBytes) || downloadedBytes,
    createdAt: Number(item.createdAt) || Date.now(),
    updatedAt: Number(item.updatedAt) || Date.now(),
  };
}

function inferDownloadStatus(chapters) {
  if (!chapters.length) return "queued";
  if (chapters.every((chapter) => chapter.status === "complete")) return "complete";
  if (chapters.some((chapter) => chapter.status === "downloading")) return "downloading";
  if (chapters.some((chapter) => chapter.status === "failed")) return "failed";
  if (chapters.some((chapter) => chapter.status === "paused")) return "paused";
  return "queued";
}

export function normalizeDownloads(raw) {
  if (!raw || !Array.isArray(raw.items)) return { version: 1, items: [] };
  return {
    version: 1,
    items: raw.items.map(normalizeDownloadItem).filter(Boolean),
  };
}

export function listDownloads(raw) {
  return normalizeDownloads(raw).items.sort((left, right) => right.updatedAt - left.updatedAt);
}

export function getDownloadStats(items) {
  const list = Array.isArray(items) ? items : [];
  const complete = list.filter((item) => item.status === "complete").length;
  const active = list.filter((item) => item.status === "downloading" || item.status === "queued").length;
  const failed = list.filter((item) => item.status === "failed").length;
  const storageBytes = list.reduce((sum, item) => sum + (item.downloadedBytes || 0), 0);
  const chapters = list.reduce((sum, item) => sum + item.chapters.length, 0);
  return { total: list.length, complete, active, failed, storageBytes, chapters };
}

export function filterDownloads(items, { query = "", status = "all", mediaType = "all" } = {}) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  return items.filter((item) => {
    if (status !== "all" && item.status !== status) return false;
    if (mediaType !== "all" && item.mediaType !== mediaType) return false;
    if (!normalizedQuery) return true;
    const haystack = `${item.title} ${item.sourceId}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function buildDownloadId(sourceId, seriesUrl) {
  return `${String(sourceId || "")}::${String(seriesUrl || "")}`;
}

function findDownloadItem(store, downloadId) {
  return store.items.find((item) => item.id === downloadId) || null;
}

export function upsertDownloadChapter(store, itemMeta, chapter, patch = {}) {
  const normalized = normalizeDownloads(store);
  const downloadId = buildDownloadId(itemMeta.sourceId, itemMeta.seriesUrl);
  const now = Date.now();
  const chapterEntry = {
    url: String(chapter.url),
    number: String(chapter.number || ""),
    name: String(chapter.name || chapter.number || ""),
    status: patch.status || "queued",
    progress: Math.max(0, Math.min(100, Number(patch.progress) || 0)),
    sizeBytes: Math.max(0, Number(patch.sizeBytes) || 0),
    downloadedAt: Number(patch.downloadedAt) || 0,
  };

  const existing = findDownloadItem(normalized, downloadId);
  if (!existing) {
    const nextItem = normalizeDownloadItem({
      id: downloadId,
      sourceId: itemMeta.sourceId,
      title: itemMeta.title,
      cover: itemMeta.cover,
      seriesUrl: itemMeta.seriesUrl,
      mediaType: itemMeta.mediaType || "novel",
      chapters: [chapterEntry],
      createdAt: now,
      updatedAt: now,
    });
    return {
      ...normalized,
      items: [...normalized.items, nextItem],
    };
  }

  const chapters = [...existing.chapters];
  const index = chapters.findIndex((entry) => entry.url === chapter.url);
  if (index >= 0) {
    chapters[index] = normalizeChapter({ ...chapters[index], ...chapterEntry });
  } else {
    chapters.push(normalizeChapter(chapterEntry));
  }

  const nextItem = normalizeDownloadItem({
    ...existing,
    chapters,
    updatedAt: now,
  });

  return {
    ...normalized,
    items: normalized.items.map((item) => (item.id === downloadId ? nextItem : item)),
  };
}

export function isChapterDownloaded(store, sourceId, seriesUrl, chapterUrl) {
  const item = findDownloadItem(normalizeDownloads(store), buildDownloadId(sourceId, seriesUrl));
  if (!item) return false;
  return item.chapters.some((entry) => entry.url === chapterUrl && entry.status === "complete");
}

export function removeDownloadItem(store, id) {
  const normalized = normalizeDownloads(store);
  return {
    ...normalized,
    items: normalized.items.filter((item) => item.id !== id),
  };
}

export function clearDownloads(store) {
  return { ...normalizeDownloads(store), items: [] };
}

export function resolveOpenChapter(item) {
  const chapters = item?.chapters || [];
  const complete = chapters.find((chapter) => chapter.status === "complete");
  return complete || chapters[0] || null;
}

export function buildLiveItemFromDownload(item) {
  return {
    title: item.title,
    cover: item.cover,
    url: item.seriesUrl,
    sourceId: item.sourceId,
    type: item.mediaType,
  };
}
