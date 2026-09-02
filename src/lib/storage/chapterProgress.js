import { getChapterScrollKey } from "../readingProgress";
import { kvGetStringSync, kvSetString } from "./kvStore";

export const CHAPTER_READ_THRESHOLD = 90;

export function getChapterProgress(sourceId, chapterUrl) {
  const key = getChapterScrollKey(sourceId, chapterUrl);
  const raw = kvGetStringSync(key, "0");
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function setChapterProgress(sourceId, chapterUrl, progress) {
  const key = getChapterScrollKey(sourceId, chapterUrl);
  const normalized = Math.min(100, Math.max(0, Math.round(progress)));
  kvSetString(key, String(normalized));
}

function findChapterReadLogEntry(chapter, logEntries = []) {
  const url = String(chapter?.url || "");
  const number = chapter?.number != null ? String(chapter.number) : "";
  const name = chapter?.name != null ? String(chapter.name) : "";
  return logEntries.find((entry) => entry.chapterUrl && entry.chapterUrl === url)
    || logEntries.find((entry) => number && String(entry.chapterNumber) === number)
    || logEntries.find((entry) => name && String(entry.chapterName) === name)
    || null;
}

export function getChapterReadState(sourceId, chapter, logEntries = []) {
  const url = chapter?.url || "";
  const storedProgress = url ? getChapterProgress(sourceId, url) : 0;
  const logEntry = findChapterReadLogEntry(chapter, logEntries);
  const logProgress = Number(logEntry?.progress) || 0;
  const progress = Math.max(storedProgress, logProgress);
  const read = progress >= CHAPTER_READ_THRESHOLD || Boolean(logEntry?.completed);
  const inProgress = progress > 0 && !read;
  return { progress, read, inProgress };
}

export function isChapterRead(sourceId, chapterUrl, progress = getChapterProgress(sourceId, chapterUrl)) {
  return progress >= CHAPTER_READ_THRESHOLD;
}

export function isChapterInProgress(sourceId, chapterUrl, progress = getChapterProgress(sourceId, chapterUrl)) {
  return progress > 0 && progress < CHAPTER_READ_THRESHOLD;
}
