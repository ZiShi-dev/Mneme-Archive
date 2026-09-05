import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { downloadChapter, resolveDownloadMediaType } from "./chapterDownloadService.js";
import {
  backgroundJobProgress,
  buildBackgroundJob,
  getActiveBackgroundJob,
  getBackgroundJob,
  getBackgroundJobByItem,
  findDisplayBackgroundJob,
  patchBackgroundJob,
  upsertBackgroundJob,
} from "./backgroundDownloadQueue.js";
import { isResumableBackgroundJob } from "./backgroundDownloadJobModel.js";
import { normalizeDownloads, DOWNLOADS_STORAGE_KEY, EMPTY_DOWNLOADS } from "./downloadsModel.js";
import { kvGet } from "../storage/initStorage.js";
import { showBackgroundDownloadCompleteNotification } from "../notifications/nativeNotifications.js";
import {
  registerBackgroundDownloadTask,
  unregisterBackgroundDownloadTask,
} from "./backgroundDownloadTask.js";
import { cancelMangaDownloadBatch } from "./mangaDownloadService.js";
import { cancelNovelDownloadBatch } from "./novelDownloadService.js";

const progressListeners = new Set();
const storeListeners = new Set();
let runnerPromise = null;
let appListener = null;

function notifyProgressListeners(job) {
  const progress = backgroundJobProgress(job);
  for (const listener of progressListeners) {
    listener(progress);
  }
}

export function subscribeBackgroundDownload(listener) {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

export function subscribeBackgroundDownloadStore(listener) {
  storeListeners.add(listener);
  return () => storeListeners.delete(listener);
}

async function notifyStoreListeners() {
  if (!storeListeners.size) return;
  const store = normalizeDownloads(await kvGet(DOWNLOADS_STORAGE_KEY, EMPTY_DOWNLOADS));
  for (const listener of storeListeners) {
    listener(store);
  }
}

async function refreshDownloadsStore() {
  await notifyStoreListeners();
}

async function syncBackgroundTaskRegistration() {
  const active = await getActiveBackgroundJob();
  if (!active) {
    await unregisterBackgroundDownloadTask();
  }
}

function cancelInFlightChapterDownload(job) {
  const mediaType = resolveDownloadMediaType(job.item);
  if (mediaType === "novel") {
    cancelNovelDownloadBatch(job.id);
  } else {
    cancelMangaDownloadBatch(job.id);
  }
}

async function finishJob(job, { cancelled = false } = {}) {
  const status = cancelled ? "cancelled" : "complete";
  const next = await patchBackgroundJob(job.id, { status });
  if (next) notifyProgressListeners(next);
  if (!cancelled && next?.failedUrls.length === 0) {
    await showBackgroundDownloadCompleteNotification(next.item);
  }
  await syncBackgroundTaskRegistration();
  return next;
}

async function processNextChapter(job) {
  if (!job || job.status !== "running") return job;
  const pendingUrl = job.pendingUrls[0];
  if (!pendingUrl) {
    return finishJob(job);
  }

  const chapter = job.chapterByUrl.get(pendingUrl);
  if (!chapter) {
    return patchBackgroundJob(job.id, {
      failedUrls: [...job.failedUrls, pendingUrl],
    });
  }

  try {
    await downloadChapter(job.item, chapter, {
      onStoreUpdate: refreshDownloadsStore,
    });
    const latest = await getBackgroundJob(job.id);
    if (!latest || latest.status !== "running") {
      return latest;
    }
    const next = await patchBackgroundJob(job.id, {
      completedUrls: [...latest.completedUrls, chapter.url],
    });
    notifyProgressListeners(next);
    return next;
  } catch {
    const latest = await getBackgroundJob(job.id);
    const failedUrls = [...(latest?.failedUrls || job.failedUrls), chapter.url];
    const next = await patchBackgroundJob(job.id, { failedUrls });
    notifyProgressListeners(next);
    return next;
  }
}

async function runBackgroundDownloadLoop() {
  while (true) {
    const job = await getActiveBackgroundJob();
    if (!job) break;
    const next = await processNextChapter(job);
    if (!next || next.status !== "running") break;
    if (!next.pendingUrls.length) {
      await finishJob(next);
      break;
    }
  }
}

export async function getBackgroundDownloadProgress(jobId) {
  const job = jobId ? await getBackgroundJob(jobId) : await findDisplayBackgroundJob();
  return isResumableBackgroundJob(job) ? backgroundJobProgress(job) : null;
}

export async function getBackgroundDownloadProgressForItem(item) {
  if (!item?.sourceId || !item?.url) return null;
  const job = await getBackgroundJobByItem(item.sourceId, item.url);
  return backgroundJobProgress(job);
}

export async function startBackgroundDownloadRunner() {
  if (runnerPromise) return runnerPromise;
  runnerPromise = runBackgroundDownloadLoop().finally(() => {
    runnerPromise = null;
  });
  return runnerPromise;
}

export async function enqueueBackgroundDownload(item, chapters) {
  const job = buildBackgroundJob(item, chapters);
  if (!job) throw new Error("invalid_background_download_job");
  const existing = await getBackgroundJob(job.id);
  if (existing?.status === "paused" && existing.pendingUrls.length) {
    return resumeBackgroundDownload(job.id);
  }
  await upsertBackgroundJob(job);
  await registerBackgroundDownloadTask();
  notifyProgressListeners(job);
  void startBackgroundDownloadRunner();
  return backgroundJobProgress(job);
}

export async function resumeBackgroundDownloads() {
  const running = await getActiveBackgroundJob();
  if (!running) return null;
  await registerBackgroundDownloadTask();
  void startBackgroundDownloadRunner();
  return backgroundJobProgress(running);
}

export async function pauseBackgroundDownload(jobId) {
  const job = await getBackgroundJob(jobId);
  if (!job || job.status !== "running") return null;
  cancelInFlightChapterDownload(job);
  const next = await patchBackgroundJob(job.id, { status: "paused" });
  notifyProgressListeners(next);
  await syncBackgroundTaskRegistration();
  return backgroundJobProgress(next);
}

export async function resumeBackgroundDownload(jobId) {
  const job = await getBackgroundJob(jobId);
  if (!job || job.status !== "paused" || !job.pendingUrls.length) return null;
  const running = await getActiveBackgroundJob();
  if (running && running.id !== jobId) {
    await pauseBackgroundDownload(running.id);
  }
  const next = await patchBackgroundJob(job.id, { status: "running" });
  notifyProgressListeners(next);
  await registerBackgroundDownloadTask();
  void startBackgroundDownloadRunner();
  return backgroundJobProgress(next);
}

export async function cancelBackgroundDownload(jobId) {
  const job = await getBackgroundJob(jobId);
  if (!job) return null;
  if (job.status === "running") {
    cancelInFlightChapterDownload(job);
  }
  const next = await patchBackgroundJob(job.id, { status: "cancelled" });
  notifyProgressListeners(next);
  await syncBackgroundTaskRegistration();
  return backgroundJobProgress(next);
}

export async function processBackgroundDownloadBurst(maxChapters = 2) {
  let processed = 0;
  while (processed < maxChapters) {
    const job = await getActiveBackgroundJob();
    if (!job) break;
    const next = await processNextChapter(job);
    processed += 1;
    if (!next?.pendingUrls.length || next.status !== "running") {
      if (next && !next.pendingUrls.length) {
        await finishJob(next);
      }
      break;
    }
  }
  return processed;
}

export function ensureBackgroundDownloadAppListener() {
  if (!Capacitor.isNativePlatform() || appListener) return;
  void App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) {
      void resumeBackgroundDownloads();
    }
  }).then((handle) => {
    appListener = handle;
  });
}
