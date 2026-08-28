import { getLocale, t } from "../../i18n/runtime.js";

export const NEW_CHAPTER_WINDOW_MS = 24 * 60 * 60 * 1000;

function isSameCalendarDay(left, right) {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function parseChapterPublishedAt(chapter) {
  const raw = chapter?.publishedAt || chapter?.createdAt || chapter?.date;
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return null;
}

export function isChapterWithinNewWindow(publishedAt, now = Date.now()) {
  if (!publishedAt) return false;
  const timestamp = new Date(publishedAt).getTime();
  if (Number.isNaN(timestamp)) return false;
  return now - timestamp < NEW_CHAPTER_WINDOW_MS;
}

export function formatChapterPublishedLabel(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = Math.max(0, now - date);
  const diffMins = Math.floor(diffMs / 60000);
  const locale = getLocale() === "fr" ? "fr" : "ar";

  if (diffMins < 2) return t("history.now");
  if (diffMins < 60) return t("history.minutesAgo", { n: diffMins });

  if (isSameCalendarDay(date, now)) {
    return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 24) return t("history.hoursAgo", { n: diffHours });

  return date.toLocaleString(locale === "fr" ? "fr-FR" : "ar", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDetailUpdatedAt(isoDate) {
  return formatChapterPublishedLabel(isoDate);
}
