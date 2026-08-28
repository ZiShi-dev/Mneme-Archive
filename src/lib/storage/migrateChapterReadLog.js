import { STORAGE_META_CHAPTER_LOG_BACKFILL } from "./constants";
import { buildChapterLogBackfill } from "../reading/backfillChapterReadLog";
import { kvGet, kvHasSync, kvSet, listChapterProgressEntries } from "./kvStore";

export async function migrateChapterReadLogBackfill() {
  if (kvHasSync(STORAGE_META_CHAPTER_LOG_BACKFILL)) return;

  const readingHistory = await kvGet("living-archive:reading-history", {});
  const existingLog = await kvGet("living-archive:chapter-read-log", {});
  const progressEntries = listChapterProgressEntries();
  const nextLog = buildChapterLogBackfill(readingHistory, existingLog, progressEntries);

  if (JSON.stringify(nextLog) !== JSON.stringify(existingLog)) {
    await kvSet("living-archive:chapter-read-log", nextLog);
  }

  await kvSet(STORAGE_META_CHAPTER_LOG_BACKFILL, true);
}
