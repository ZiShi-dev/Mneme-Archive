import { kvGet, kvSet } from "../storage/initStorage.js";
import { buildDownloadId } from "./downloadsModel.js";
import {
  backgroundJobProgress,
  buildBackgroundJob,
  isResumableBackgroundJob,
  normalizeBackgroundDownloadQueue,
  normalizeBackgroundJob,
} from "./backgroundDownloadJobModel.js";

export const BACKGROUND_DOWNLOAD_QUEUE_KEY = "living-archive:download-queue";

export const EMPTY_BACKGROUND_DOWNLOAD_QUEUE = Object.freeze({ version: 1, jobs: [] });

export {
  backgroundJobProgress,
  buildBackgroundJob,
  normalizeBackgroundDownloadQueue,
  normalizeBackgroundJob,
} from "./backgroundDownloadJobModel.js";

let cachedQueue = null;

export async function readBackgroundDownloadQueue({ fresh = false } = {}) {
  if (!fresh && cachedQueue) return cachedQueue;
  cachedQueue = normalizeBackgroundDownloadQueue(
    await kvGet(BACKGROUND_DOWNLOAD_QUEUE_KEY, EMPTY_BACKGROUND_DOWNLOAD_QUEUE),
  );
  return cachedQueue;
}

export async function writeBackgroundDownloadQueue(queue) {
  cachedQueue = normalizeBackgroundDownloadQueue(queue);
  await kvSet(BACKGROUND_DOWNLOAD_QUEUE_KEY, cachedQueue);
  return cachedQueue;
}

export async function upsertBackgroundJob(job) {
  const normalized = normalizeBackgroundJob(job);
  if (!normalized) return null;
  const queue = await readBackgroundDownloadQueue();
  const jobs = queue.jobs.filter((entry) => entry.id !== normalized.id);
  jobs.push(normalized);
  await writeBackgroundDownloadQueue({ version: 1, jobs });
  return normalized;
}

export async function patchBackgroundJob(jobId, patch = {}) {
  const queue = await readBackgroundDownloadQueue();
  const index = queue.jobs.findIndex((entry) => entry.id === jobId);
  if (index < 0) return null;
  const nextJob = normalizeBackgroundJob({
    ...queue.jobs[index],
    ...patch,
    updatedAt: Date.now(),
  });
  if (!nextJob) return null;
  const jobs = [...queue.jobs];
  jobs[index] = nextJob;
  await writeBackgroundDownloadQueue({ version: 1, jobs });
  return nextJob;
}

export async function getActiveBackgroundJob() {
  const queue = await readBackgroundDownloadQueue();
  return queue.jobs.find((job) => job.status === "running" && job.pendingUrls.length > 0) || null;
}

export async function getBackgroundJob(jobId) {
  const queue = await readBackgroundDownloadQueue();
  return queue.jobs.find((entry) => entry.id === jobId) || null;
}

export async function getBackgroundJobByItem(sourceId, seriesUrl) {
  const job = await getBackgroundJob(buildDownloadId(sourceId, seriesUrl));
  return isResumableBackgroundJob(job) ? job : null;
}

export async function findResumableBackgroundJob() {
  const queue = await readBackgroundDownloadQueue();
  return queue.jobs.find((job) => isResumableBackgroundJob(job)) || null;
}

export async function findDisplayBackgroundJob() {
  const running = await getActiveBackgroundJob();
  if (running) return running;
  const queue = await readBackgroundDownloadQueue();
  return queue.jobs.find(
    (job) => job.status === "paused" && job.pendingUrls.length > 0,
  ) || null;
}
