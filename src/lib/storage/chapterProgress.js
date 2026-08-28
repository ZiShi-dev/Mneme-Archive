import { getChapterScrollKey } from "../readingProgress";
import { kvGetStringSync, kvSetString } from "./kvStore";

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
