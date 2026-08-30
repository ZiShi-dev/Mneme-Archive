import { resolveSourceId } from "../config/sources";
import { getChapterProgress } from "./storage/chapterProgress";
import { resolveBookmarkType } from "../features/sources/contentTypes";
import { getLocale, t } from "../i18n/runtime.js";
import {
  getMaxScrollTop,
  getReaderScrollElement,
  getScrollHeight,
  getScrollTop,
  getScrollViewportHeight,
} from "./platform/scrollRoot.js";

export const HISTORY_DAY_GROUPS = {
  today: "today",
  yesterday: "yesterday",
  week: "week",
  older: "older",
};

export function historyDayGroupLabel(group) {
  if (group === "today") return t("history.today");
  if (group === "yesterday") return t("history.yesterday");
  if (group === "week") return t("history.thisWeek");
  return t("history.earlier");
}

export function getTitleReadingKey(item) {
  if (!item?.url && item?.id) return `demo:${item.id}`;
  return `${resolveSourceId(item)}:${item.url}`;
}

export function getChapterScrollKey(sourceId, chapterUrl) {
  return `living-archive:chapter-progress:${sourceId}:${chapterUrl}`;
}

export function isSameCalendarDay(left, right) {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function isReadToday(record) {
  if (!record?.completed || !record?.completedAt) return false;
  return isSameCalendarDay(record.completedAt, new Date());
}

export const CHAPTER_COMPLETE_SCROLL_GAP = 56;
export const CHAPTER_COMPLETE_MIN_PROGRESS = 92;

export function computeReaderScrollProgress(root = getReaderScrollElement()) {
  const maximum = getMaxScrollTop(root);
  if (maximum <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((getScrollTop(root) / maximum) * 100)));
}

export function isReaderAtBottom(gap = CHAPTER_COMPLETE_SCROLL_GAP, root = getReaderScrollElement()) {
  return getScrollTop(root) + getScrollViewportHeight(root) >= getScrollHeight(root) - gap;
}

export function shouldMarkChapterComplete({ userHasScrolled, scrollProgress } = {}) {
  if (!userHasScrolled) return false;
  const root = getReaderScrollElement();
  const maximum = getMaxScrollTop(root);
  const progress = scrollProgress ?? computeReaderScrollProgress(root);
  if (maximum <= 120) return isReaderAtBottom(CHAPTER_COMPLETE_SCROLL_GAP, root);
  return isReaderAtBottom(CHAPTER_COMPLETE_SCROLL_GAP, root) && progress >= CHAPTER_COMPLETE_MIN_PROGRESS;
}

export function normalizeReadingRecord(record) {
  if (!record?.completed) return record;
  const saved = getChapterProgress(record.sourceId, record.chapterUrl);
  if (saved > 0 && saved < CHAPTER_COMPLETE_MIN_PROGRESS) {
    return {
      ...record,
      completed: false,
      completedAt: null,
      progress: Math.min(99, saved),
    };
  }
  return record;
}

export function isRecordCompleted(record) {
  return Boolean(normalizeReadingRecord(record)?.completed);
}

export function getRecordProgress(record) {
  const normalized = normalizeReadingRecord(record);
  if (!normalized) return 0;
  return Math.min(100, Math.max(0, normalized.progress || 0));
}

export function buildReadingRecord(item, chapter, progress, { completed = false } = {}) {
  const now = new Date().toISOString();
  const normalizedProgress = completed ? 100 : Math.min(99, Math.max(0, Math.round(progress)));
  return {
    sourceId: resolveSourceId(item),
    titleUrl: item.url || `demo:${item.id}`,
    demoId: item.id || null,
    title: item.title || "",
    altTitle: item.altTitle || item.subtitle || "",
    cover: item.cover || "",
    mediaType: item.mediaType || null,
    chapterUrl: chapter.url || `demo-chapter:${chapter.number ?? chapter.name}`,
    chapterNumber: chapter.number ?? chapter.name,
    chapterName: chapter.name ?? String(chapter.number ?? ""),
    progress: normalizedProgress,
    completed,
    completedAt: completed ? now : null,
    lastReadAt: now,
  };
}

export function mergeReadingRecord(previous, next) {
  if (!previous || previous.chapterUrl !== next.chapterUrl) return next;
  if (next.completed) return next;
  return { ...next, completed: false, completedAt: null };
}

export function findChapterByRecord(chapters, record) {
  if (!record || !chapters?.length) return null;
  return chapters.find((chapter) => chapter.url === record.chapterUrl)
    || chapters.find((chapter) => String(chapter.number) === String(record.chapterNumber))
    || chapters.find((chapter) => String(chapter.name) === String(record.chapterName))
    || null;
}

export function getHistoryDayGroup(isoDate) {
  if (!isoDate) return "older";
  const date = new Date(isoDate);
  const now = new Date();
  if (isSameCalendarDay(date, now)) return "today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) return "yesterday";
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (date > weekAgo) return "week";
  return "older";
}

export function formatRelativeReadingTime(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = Math.max(0, now - date);
  const diffMins = Math.floor(diffMs / 60000);
  const locale = getLocale() === "fr" ? "fr" : "ar";
  if (diffMins < 2) return t("history.now");
  if (diffMins < 60) return t("history.minutesAgo", { n: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (isSameCalendarDay(date, now)) return t("history.hoursAgo", { n: diffHours });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) return t("history.yesterday");
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) return t("history.daysAgo", { n: diffDays });
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

export function listReadingHistory(readingHistory) {
  return Object.entries(readingHistory || {})
    .map(([key, record]) => ({ key, record }))
    .filter(({ record }) => record?.lastReadAt)
    .sort((a, b) => new Date(b.record.lastReadAt) - new Date(a.record.lastReadAt));
}

export function enrichHistoryEntries(readingHistory, { demoCatalog = [], liveFavorites = [] } = {}) {
  return listReadingHistory(readingHistory).map((entry) => {
    const record = normalizeReadingRecord(entry.record);
    return {
      ...entry,
      record,
      type: resolveBookmarkType(record),
      target: resolveHistoryTarget(record, { demoCatalog, liveFavorites }),
    };
  });
}

export function getLatestReadingEntry(readingHistory, { mediaType = "all", demoCatalog = [], liveFavorites = [] } = {}) {
  return enrichHistoryEntries(readingHistory, { demoCatalog, liveFavorites })
    .filter((entry) => entry.target)
    .find((entry) => mediaType === "all" || entry.type === mediaType) || null;
}

export function countHistoryByType(readingHistory, { demoCatalog = [], liveFavorites = [] } = {}) {
  const entries = enrichHistoryEntries(readingHistory, { demoCatalog, liveFavorites }).filter((entry) => entry.target);
  return {
    all: entries.length,
    manga: entries.filter((entry) => entry.type === "manga").length,
    novel: entries.filter((entry) => entry.type === "novel").length,
    anime: entries.filter((entry) => entry.type === "anime").length,
    movie: entries.filter((entry) => entry.type === "movie").length,
  };
}

export function formatHistoryUnitLabel(record) {
  if (!record) return "";
  const type = resolveBookmarkType(record);
  const chapterLabel = record.chapterName || record.chapterNumber;
  if (type === "movie") return t("home.film");
  if (type === "anime" || type === "series") return t("home.episode", { label: chapterLabel });
  return t("home.chapter", { label: chapterLabel });
}

export function formatHeroChapterLine(record) {
  if (!record) return "";
  const progress = getRecordProgress(record);
  const unitLabel = formatHistoryUnitLabel(record);
  if (isRecordCompleted(record)) {
    const done = resolveBookmarkType(record) === "anime" ? t("home.completedFemale") : t("home.completed");
    return `${unitLabel} · ${done}`;
  }
  return `${unitLabel} · ${progress}%`;
}

export function groupHistoryEntries(entries) {
  const order = ["today", "yesterday", "week", "older"];
  return order
    .map((id) => ({
      id,
      label: historyDayGroupLabel(id),
      items: entries.filter((entry) => getHistoryDayGroup(entry.record.lastReadAt) === id),
    }))
    .filter((group) => group.items.length > 0);
}

export function chapterFromRecord(record) {
  if (!record) return null;
  return {
    url: record.chapterUrl,
    number: record.chapterNumber,
    name: record.chapterName || String(record.chapterNumber ?? ""),
  };
}

export function resolveHistoryTarget(record, { demoCatalog = [], liveFavorites = [] } = {}) {
  if (!record) return null;
  if (record.demoId) {
    const item = demoCatalog.find((entry) => entry.id === record.demoId);
    if (item) return { kind: "demo", item, chapter: chapterFromRecord(record) };
  }
  if (String(record.titleUrl || "").startsWith("demo:")) {
    const demoId = record.titleUrl.replace("demo:", "");
    const item = demoCatalog.find((entry) => entry.id === demoId);
    if (item) return { kind: "demo", item, chapter: chapterFromRecord(record) };
  }
  const favorite = liveFavorites.find((entry) => entry.url === record.titleUrl);
  const item = favorite || {
    url: record.titleUrl,
    title: record.title || t("common.unknownTitle"),
    altTitle: record.altTitle || "",
    cover: record.cover || "",
    sourceId: record.sourceId,
    mediaType: record.mediaType,
  };
  return { kind: "live", item, chapter: chapterFromRecord(record) };
}
