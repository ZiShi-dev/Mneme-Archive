import { getLocale, t } from "../../i18n/runtime.js";

const MAX_CHAPTERS_PER_TITLE = 300;

export function chapterEntryFromRecord(record) {
  if (!record?.chapterUrl) return null;
  return {
    chapterUrl: record.chapterUrl,
    chapterNumber: record.chapterNumber,
    chapterName: record.chapterName || String(record.chapterNumber ?? ""),
    readAt: record.lastReadAt || record.completedAt || new Date().toISOString(),
    completedAt: record.completedAt || null,
    completed: Boolean(record.completed),
    progress: Math.min(100, Math.max(0, Number(record.progress) || 0)),
  };
}

export function upsertChapterReadLog(log = {}, titleKey, record) {
  const entry = chapterEntryFromRecord(record);
  if (!entry) return log;

  const current = Array.isArray(log[titleKey]) ? [...log[titleKey]] : [];
  const index = current.findIndex((item) => item.chapterUrl === entry.chapterUrl);

  if (index >= 0) {
    current[index] = { ...current[index], ...entry };
  } else {
    current.push(entry);
  }

  const sorted = current
    .sort((left, right) => new Date(right.readAt) - new Date(left.readAt))
    .slice(0, MAX_CHAPTERS_PER_TITLE);

  return { ...log, [titleKey]: sorted };
}

export function listTitleChapterReads(chapterReadLog, titleKey, fallbackRecord) {
  const entries = Array.isArray(chapterReadLog?.[titleKey]) ? [...chapterReadLog[titleKey]] : [];

  if (!entries.length) {
    const fallback = chapterEntryFromRecord(fallbackRecord);
    if (fallback) return [fallback];
    return [];
  }

  return entries.sort((left, right) => new Date(right.readAt) - new Date(left.readAt));
}

export function removeTitleChapterLog(log = {}, titleKey) {
  if (!log[titleKey]) return log;
  const next = { ...log };
  delete next[titleKey];
  return next;
}

export function formatChapterReadDate(isoDate) {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";
  const locale = getLocale() === "fr" ? "fr" : "ar";
  return date.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function chapterLabel(entry, type = "manga") {
  if (!entry) {
    if (type === "movie") return t("media.movie");
    if (type === "anime") return t("media.episode");
    return t("media.chapter");
  }
  if (type === "movie") return t("media.theMovie");
  if (type === "anime") return entry.chapterName || t("home.episode", { label: entry.chapterNumber });
  return entry.chapterName || t("home.chapter", { label: entry.chapterNumber });
}
