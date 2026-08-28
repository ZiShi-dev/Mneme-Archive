import { CHAPTER_PROGRESS_PREFIX } from "../storage/constants.js";
import { upsertChapterReadLog } from "./chapterReadLog.js";
import { getLocale, t } from "../../i18n/runtime.js";

const CHAPTER_COMPLETE_PROGRESS = 92;

export function parseChapterProgressKey(key) {
  if (!key?.startsWith(CHAPTER_PROGRESS_PREFIX)) return null;
  const rest = key.slice(CHAPTER_PROGRESS_PREFIX.length);
  const separator = rest.indexOf(":");
  if (separator < 0) return null;
  return {
    sourceId: rest.slice(0, separator),
    chapterUrl: rest.slice(separator + 1),
  };
}

export function inferChapterMeta(chapterUrl) {
  if (String(chapterUrl).startsWith("demo-chapter:")) {
    const number = chapterUrl.replace("demo-chapter:", "");
    return { chapterNumber: number, chapterName: number };
  }

  try {
    const segment = new URL(chapterUrl).pathname.split("/").filter(Boolean).pop() || "";
    const number = segment.replace(/[^\d.]/g, "") || segment;
    return { chapterNumber: number, chapterName: segment || number };
  } catch {
    const segment = String(chapterUrl).split("/").pop() || "؟";
    const number = segment.replace(/[^\d.]/g, "") || segment;
    return { chapterNumber: number, chapterName: segment };
  }
}

export function resolveTitleKeyForChapter(sourceId, chapterUrl, readingHistory = {}) {
  const prefix = `${sourceId}:`;
  const matches = Object.entries(readingHistory).filter(([key]) => key.startsWith(prefix));
  if (!matches.length) return null;

  const exact = matches.find(([, record]) => record.chapterUrl === chapterUrl);
  if (exact) return exact[0];

  const byPath = matches.find(([, record]) => {
    if (!record?.titleUrl) return false;
    return chapterUrl.includes(record.titleUrl) || record.titleUrl.includes(chapterUrl.split("/").slice(0, -1).join("/"));
  });
  if (byPath) return byPath[0];

  return matches[0][0];
}

export function buildChapterLogBackfill(readingHistory = {}, existingLog = {}, progressEntries = []) {
  let log = { ...existingLog };

  Object.entries(readingHistory).forEach(([titleKey, record]) => {
    if (record?.lastReadAt || record?.chapterUrl) {
      log = upsertChapterReadLog(log, titleKey, record);
    }
  });

  progressEntries.forEach(({ key, progress }) => {
    const parsed = parseChapterProgressKey(key);
    if (!parsed) return;

    const titleKey = resolveTitleKeyForChapter(parsed.sourceId, parsed.chapterUrl, readingHistory);
    if (!titleKey) return;

    const historyRecord = readingHistory[titleKey];
    const { chapterNumber, chapterName } = inferChapterMeta(parsed.chapterUrl);
    const completed = progress >= CHAPTER_COMPLETE_PROGRESS;

    log = upsertChapterReadLog(log, titleKey, {
      chapterUrl: parsed.chapterUrl,
      chapterNumber: historyRecord?.chapterNumber === chapterNumber ? historyRecord.chapterNumber : chapterNumber,
      chapterName: historyRecord?.chapterUrl === parsed.chapterUrl
        ? (historyRecord.chapterName || chapterName)
        : chapterName,
      lastReadAt: historyRecord?.chapterUrl === parsed.chapterUrl
        ? (historyRecord.lastReadAt || historyRecord.completedAt || new Date().toISOString())
        : historyRecord?.lastReadAt || new Date().toISOString(),
      completedAt: completed ? (historyRecord?.completedAt || historyRecord?.lastReadAt || null) : null,
      completed,
      progress,
    });
  });

  return log;
}

export function groupChapterReadsByDay(chapters = []) {
  const groups = new Map();

  chapters.forEach((chapter) => {
    const dayKey = chapter.readAt ? new Date(chapter.readAt).toDateString() : "unknown";
    if (!groups.has(dayKey)) {
      groups.set(dayKey, {
        id: dayKey,
        label: formatDayLabel(chapter.readAt),
        items: [],
      });
    }
    groups.get(dayKey).items.push(chapter);
  });

  return [...groups.values()];
}

function formatDayLabel(isoDate) {
  if (!isoDate) return t("history.noDate");
  const date = new Date(isoDate);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return t("history.today");
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return t("history.yesterday");
  const locale = getLocale() === "fr" ? "fr" : "ar";
  return date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" });
}
