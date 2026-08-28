import { fetchSourceDetails } from "../../features/sources/sourceApi";
import { isChromebookApp, isNotifiableMediaType } from "../../config/appFlavor";
import { getItemType } from "../../features/sources/contentTypes";
import { buildFollowItem, getFollowKey } from "./followKeys";
import {
  buildChapterSnapshot,
  buildUpdateLabel,
  listNewChapters,
  normalizeFollowPreference,
  shouldAnnounceChapter,
} from "./followPolicy";
import { t } from "../../i18n/runtime.js";

function createUpdateEvent(item, chapter, preference, kind = "auto") {
  const key = getFollowKey(item);
  const chapterNumber = chapter.number ?? chapter.name;
  return {
    id: `${key}:${chapter.url}:${Date.now()}`,
    followKey: key,
    kind,
    read: false,
    announcedAt: new Date().toISOString(),
    title: item.title,
    altTitle: item.altTitle || "",
    cover: item.cover,
    url: item.url,
    sourceId: item.sourceId,
    mediaType: item.mediaType,
    chapterUrl: chapter.url,
    chapterNumber: String(chapterNumber),
    chapterName: chapter.name || String(chapterNumber),
    label: buildUpdateLabel(preference, 1),
    interval: preference.interval,
  };
}

export async function syncFollowedTitle(item, preference, snapshot) {
  const pref = normalizeFollowPreference(preference);
  if (!pref?.enabled) {
    return { snapshot, events: [], error: null };
  }

  try {
    const details = await fetchSourceDetails(pref.sourceId, pref.url);
    const chapters = details.chapters || [];
    const resolvedMediaType = getItemType({
      ...pref,
      mediaType: details.mediaType || pref.mediaType,
      mediaTypeLabel: details.mediaTypeLabel || pref.mediaTypeLabel,
    });
    const followItem = buildFollowItem({
      ...item,
      ...pref,
      title: details.title || pref.title,
      altTitle: details.altTitle || pref.altTitle,
      cover: details.cover || pref.cover,
      mediaType: resolvedMediaType,
      mediaTypeLabel: details.mediaTypeLabel || pref.mediaTypeLabel,
    });

    if (!chapters.length) {
      return { snapshot, events: [], error: null };
    }

    const latest = chapters[0];
    if (!snapshot?.chapterUrl) {
      return {
        snapshot: buildChapterSnapshot(latest),
        events: [],
        error: null,
      };
    }

    const newChapters = listNewChapters(chapters, snapshot);
    if (!newChapters.length) {
      return {
        snapshot: buildChapterSnapshot(latest, snapshot),
        events: [],
        error: null,
      };
    }

    const events = [];
    let nextSnapshot = { ...snapshot };

    newChapters.forEach((chapter) => {
      if (!shouldAnnounceChapter(pref, nextSnapshot, chapter)) return;
      events.push(createUpdateEvent(followItem, chapter, { ...pref, mediaType: resolvedMediaType }));
      nextSnapshot = {
        ...buildChapterSnapshot(latest, nextSnapshot),
        lastAnnouncedNumber: Number(chapter.number ?? chapter.name) || nextSnapshot.lastAnnouncedNumber,
      };
    });

    if (!events.length) {
      nextSnapshot = buildChapterSnapshot(latest, snapshot);
    }

    return { snapshot: nextSnapshot, events, error: null };
  } catch (error) {
    return {
      snapshot,
      events: [],
      error: error instanceof Error ? error.message : t("updates.checkFailed"),
    };
  }
}

export async function syncAllFollowedTitles(preferences, snapshots) {
  const entries = Object.entries(preferences || {});
  const nextSnapshots = { ...snapshots };
  const nextEvents = [];
  const errors = [];

  for (const [key, preference] of entries) {
    const pref = normalizeFollowPreference(preference);
    if (!pref?.enabled) continue;
    if (!isNotifiableMediaType(getItemType(pref))) continue;

    const result = await syncFollowedTitle(
      { ...pref, url: pref.url },
      pref,
      snapshots[key],
    );

    if (result.error) errors.push({ key, message: result.error });
    if (result.snapshot) nextSnapshots[key] = result.snapshot;
    if (result.events?.length) nextEvents.push(...result.events);
  }

  return { snapshots: nextSnapshots, events: nextEvents, errors };
}
