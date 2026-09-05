import { buildDownloadId } from "./downloadsModel.js";

export const BACKGROUND_JOB_STATUSES = Object.freeze([
  "running",
  "paused",
  "complete",
  "cancelled",
]);

export const ACTIVE_BACKGROUND_JOB_STATUSES = Object.freeze(["running", "paused"]);

export function isActiveBackgroundJobStatus(status) {
  return ACTIVE_BACKGROUND_JOB_STATUSES.includes(status);
}

function normalizeChapter(chapter) {
  if (!chapter?.url) return null;
  return {
    url: String(chapter.url),
    number: String(chapter.number || ""),
    name: String(chapter.name || chapter.number || ""),
    locked: Boolean(chapter.locked),
  };
}

function normalizeItem(item) {
  if (!item?.sourceId || !item?.url) return null;
  return {
    sourceId: String(item.sourceId),
    title: String(item.title || ""),
    cover: String(item.cover || ""),
    url: String(item.url),
    mediaType: String(item.mediaType || "manga"),
  };
}

export function normalizeBackgroundJob(job) {
  if (!job?.id || !job?.item) return null;
  const item = normalizeItem(job.item);
  if (!item) return null;
  const chapters = Array.isArray(job.chapters)
    ? job.chapters.map(normalizeChapter).filter(Boolean)
    : [];
  const completedUrls = new Set(Array.isArray(job.completedUrls) ? job.completedUrls : []);
  const failedUrls = new Set(Array.isArray(job.failedUrls) ? job.failedUrls : []);
  const pendingUrls = chapters
    .map((chapter) => chapter.url)
    .filter((url) => !completedUrls.has(url) && !failedUrls.has(url));
  const status = BACKGROUND_JOB_STATUSES.includes(job.status) ? job.status : "running";
  const chapterByUrl = new Map(chapters.map((chapter) => [chapter.url, chapter]));

  return {
    id: String(job.id),
    item,
    chapters,
    chapterByUrl,
    completedUrls: [...completedUrls],
    failedUrls: [...failedUrls],
    pendingUrls,
    status,
    createdAt: Number(job.createdAt) || Date.now(),
    updatedAt: Number(job.updatedAt) || Date.now(),
  };
}

export function normalizeBackgroundDownloadQueue(raw) {
  if (!raw || !Array.isArray(raw.jobs)) {
    return { version: 1, jobs: [] };
  }
  return {
    version: 1,
    jobs: raw.jobs.map(normalizeBackgroundJob).filter(Boolean),
  };
}

export function buildBackgroundJob(item, chapters = []) {
  const normalizedItem = normalizeItem(item);
  const normalizedChapters = chapters.map(normalizeChapter).filter(Boolean);
  if (!normalizedItem || !normalizedChapters.length) return null;
  const now = Date.now();
  return normalizeBackgroundJob({
    id: buildDownloadId(normalizedItem.sourceId, normalizedItem.url),
    item: normalizedItem,
    chapters: normalizedChapters,
    completedUrls: [],
    failedUrls: [],
    status: "running",
    createdAt: now,
    updatedAt: now,
  });
}

export function backgroundJobProgress(job) {
  if (!job) return null;
  return {
    jobId: job.id,
    item: job.item,
    completed: job.completedUrls.length,
    failed: job.failedUrls.length,
    total: job.chapters.length,
    pending: job.pendingUrls.length,
    status: job.status,
  };
}

export function isResumableBackgroundJob(job) {
  return Boolean(
    job
    && isActiveBackgroundJobStatus(job.status)
    && job.pendingUrls.length > 0,
  );
}
