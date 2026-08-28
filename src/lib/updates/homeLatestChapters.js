import { fetchSourceDetails } from "../../features/sources/sourceApi";
import { getItemType } from "../../features/sources/contentTypes";
import { getTitleReadingKey } from "../readingProgress";
import { kvGet, kvSet } from "../storage/kvStore";
import { buildFollowItem } from "./followKeys";
import {
  formatChapterPublishedLabel,
  isChapterWithinNewWindow,
  parseChapterPublishedAt,
} from "../media/chapterTiming.js";

export const HOME_CHAPTER_TTL_MS = 24 * 60 * 60 * 1000;
export { formatChapterPublishedLabel, parseChapterPublishedAt };
export const isChapterWithinHomeWindow = isChapterWithinNewWindow;
const FIRST_SEEN_KEY = "living-archive:home-chapter-first-seen";
const HOME_LATEST_RESULT_TTL_MS = 5 * 60_000;

let homeLatestResultCache = null;

function buildHomeLatestCacheKey(mediaFilter, trackedCount, limit) {
  return `${mediaFilter}:${trackedCount}:${limit}`;
}

export function collectHomeTrackedItems(followPreferences = {}) {
  const items = [];

  for (const preference of Object.values(followPreferences || {})) {
    if (preference?.enabled === false || !preference?.url) continue;
    const item = buildFollowItem(preference);
    items.push({ ...item, trackedBy: "follow" });
  }

  return items;
}

export function pickLatestChapter(chapters = [], fallback = null) {
  if (!chapters.length) return fallback;
  const readable = chapters.find((chapter) => !chapter.locked);
  return readable || chapters[0] || fallback;
}

export function isLatestChapterUnread(item, latestChapter, readingHistory = {}) {
  if (!latestChapter?.url) return false;
  const record = readingHistory[getTitleReadingKey(item)];
  if (!record?.chapterUrl) return true;
  if (record.chapterUrl === latestChapter.url) return false;

  const latestNumber = Number(latestChapter.number);
  const readNumber = Number(record.chapterNumber);
  if (Number.isFinite(latestNumber) && Number.isFinite(readNumber)) {
    return latestNumber > readNumber;
  }

  return true;
}

function pruneFirstSeenMap(map, now = Date.now()) {
  const next = {};
  for (const [chapterUrl, publishedAt] of Object.entries(map || {})) {
    if (now - new Date(publishedAt).getTime() < HOME_CHAPTER_TTL_MS * 2) {
      next[chapterUrl] = publishedAt;
    }
  }
  return next;
}

async function resolvePublishedAt(chapter, firstSeenMap) {
  const fromSource = parseChapterPublishedAt(chapter);
  if (fromSource) return fromSource;

  const cached = firstSeenMap[chapter.url];
  if (cached) return cached;

  const now = new Date().toISOString();
  firstSeenMap[chapter.url] = now;
  return now;
}

export async function fetchHomeLatestChapter(item) {
  const details = await fetchSourceDetails(item.sourceId, item.url);
  const chapters = details.chapters || [];
  const latestChapter = pickLatestChapter(chapters, item.recentChapters?.[0] || null);

  return {
    item: {
      ...item,
      title: details.title || item.title,
      altTitle: details.altTitle || item.altTitle || "",
      cover: details.cover || item.cover,
      mediaType: details.mediaType || item.mediaType,
      mediaTypeLabel: details.mediaTypeLabel || item.mediaTypeLabel,
    },
    latestChapter,
    mediaType: getItemType({ ...item, mediaType: details.mediaType || item.mediaType }),
  };
}

export async function loadHomeLatestChapters({
  followPreferences,
  readingHistory,
  mediaFilter = "all",
  limit = 12,
  concurrency = 3,
  skipCache = false,
}) {
  const tracked = collectHomeTrackedItems(followPreferences)
    .filter((item) => mediaFilter === "all" || getItemType(item) === mediaFilter);

  if (!tracked.length) {
    return { entries: [], trackedCount: 0 };
  }

  const cacheKey = buildHomeLatestCacheKey(mediaFilter, tracked.length, limit);
  if (
    !skipCache
    && homeLatestResultCache?.key === cacheKey
    && Date.now() - homeLatestResultCache.at < HOME_LATEST_RESULT_TTL_MS
  ) {
    return homeLatestResultCache.data;
  }

  const firstSeenMap = pruneFirstSeenMap(await kvGet(FIRST_SEEN_KEY, {}));
  const results = [];
  let cursor = 0;
  const now = Date.now();

  async function worker() {
    while (cursor < tracked.length) {
      const index = cursor;
      cursor += 1;
      const item = tracked[index];
      try {
        const payload = await fetchHomeLatestChapter(item);
        if (!payload.latestChapter) continue;

        const publishedAt = await resolvePublishedAt(payload.latestChapter, firstSeenMap);
        if (!isChapterWithinHomeWindow(publishedAt, now)) continue;

        results.push({
          ...payload,
          publishedAt,
          isNew: isLatestChapterUnread(payload.item, payload.latestChapter, readingHistory),
          trackedBy: item.trackedBy,
        });
      } catch {
        // Ignore failed titles; the section stays usable.
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tracked.length) }, () => worker()),
  );

  await kvSet(FIRST_SEEN_KEY, pruneFirstSeenMap(firstSeenMap, now));

  const entries = results
    .sort((left, right) => new Date(right.publishedAt) - new Date(left.publishedAt))
    .slice(0, limit);

  const payload = { entries, trackedCount: tracked.length };
  homeLatestResultCache = { key: cacheKey, at: Date.now(), data: payload };
  return payload;
}
