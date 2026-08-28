import { buildFollowUpdateLabel } from "./followMessaging";
import { t } from "../../i18n/runtime.js";

function resolveFollowInterval(preference, fallbackInterval = 1) {
  if (preference?.mode === "every") return 1;
  if (preference?.mode === "interval") {
    return Math.min(50, Math.max(1, Number(preference.interval) || fallbackInterval));
  }
  if (Number.isFinite(Number(preference?.interval))) {
    return Math.min(50, Math.max(1, Number(preference.interval)));
  }
  return fallbackInterval;
}

export function normalizeFollowPreference(preference, fallbackInterval = 1) {
  if (!preference) return null;
  const interval = resolveFollowInterval(preference, fallbackInterval);
  return {
    enabled: preference.enabled !== false,
    interval,
    title: preference.title || "",
    altTitle: preference.altTitle || "",
    cover: preference.cover || "",
    url: preference.url || "",
    sourceId: preference.sourceId || "mangalik",
    mediaType: preference.mediaType || null,
    updatedAt: preference.updatedAt || new Date().toISOString(),
  };
}

export function shouldAnnounceChapter(preference, snapshot, chapter) {
  const pref = normalizeFollowPreference(preference);
  if (!pref?.enabled) return false;

  if (pref.interval <= 1) return true;

  const chapterNumber = Number(chapter.number ?? chapter.name) || 0;
  const lastAnnounced = Number(snapshot?.lastAnnouncedNumber ?? snapshot?.chapterNumber) || 0;
  return chapterNumber >= lastAnnounced + pref.interval;
}

export function buildUpdateLabel(preference, newCount = 1) {
  const pref = normalizeFollowPreference(preference);
  if (!pref) return t("follow.newUpdate");
  return buildFollowUpdateLabel({ ...pref, ...preference }, newCount);
}

export function listNewChapters(chapters, snapshot) {
  if (!chapters?.length) return [];
  if (!snapshot?.chapterUrl) return [];

  const previousIndex = chapters.findIndex((chapter) => chapter.url === snapshot.chapterUrl);
  if (previousIndex > 0) return chapters.slice(0, previousIndex).reverse();
  if (previousIndex === 0) return [];

  const previousNumber = Number(snapshot.chapterNumber) || 0;
  const latestNumber = Number(chapters[0].number ?? chapters[0].name) || 0;
  if (latestNumber > previousNumber) return [chapters[0]];
  if (chapters[0].url !== snapshot.chapterUrl) return [chapters[0]];
  return [];
}

export function buildChapterSnapshot(chapter, previousSnapshot = null) {
  const chapterNumber = chapter.number ?? chapter.name ?? "";
  return {
    chapterUrl: chapter.url,
    chapterNumber: String(chapterNumber),
    chapterName: chapter.name || String(chapterNumber),
    lastAnnouncedNumber: Number(previousSnapshot?.lastAnnouncedNumber ?? chapterNumber) || Number(chapterNumber) || 0,
    checkedAt: new Date().toISOString(),
  };
}
