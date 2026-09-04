import { fetchSourceDetails, peekSourceDetails } from "../../features/sources/sourceApi.js";
import { getItemType } from "../../features/sources/contentTypes.js";
import { kvGet, kvSet } from "../storage/kvStore.js";
import { buildFollowItem } from "./followKeys.js";
import {
  formatChapterPublishedLabel,
  isChapterWithinNewWindow,
  parseChapterPublishedAt,
} from "../media/chapterTiming.js";
import {
  buildHomeLatestPayload,
  isLatestChapterUnread,
  pickLatestChapter,
} from "./homeLatestModel.js";

export const HOME_CHAPTER_TTL_MS = 24 * 60 * 60 * 1000;
export { formatChapterPublishedLabel, parseChapterPublishedAt };
export { buildHomeLatestPayload, isLatestChapterUnread, pickLatestChapter };
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

export async function fetchHomeLatestChapter(item) {
  const cached = peekSourceDetails(item.sourceId, item.url, item);
  const details = cached || await fetchSourceDetails(item.sourceId, item.url, item);
  return buildHomeLatestPayload(item, details);
}

export function peekHomeLatestChapters({ mediaFilter = "all", trackedCount = 0, limit = 12 } = {}) {
  const cacheKey = buildHomeLatestCacheKey(mediaFilter, trackedCount, limit);
  if (
    homeLatestResultCache?.key === cacheKey
    && Date.now() - homeLatestResultCache.at < HOME_LATEST_RESULT_TTL_MS
  ) {
    return homeLatestResultCache.data;
  }
  return null;
}

export function hydrateHomeLatestChapters({
  followPreferences,
  readingHistory,
  mediaFilter = "all",
  limit = 12,
} = {}) {
  const tracked = collectHomeTrackedItems(followPreferences)
    .filter((item) => mediaFilter === "all" || getItemType(item) === mediaFilter);
  const now = Date.now();
  const results = [];

  for (const item of tracked) {
    const details = peekSourceDetails(item.sourceId, item.url, item);
    if (!details) continue;
    const payload = buildHomeLatestPayload(item, details);
    if (!payload.latestChapter) continue;
    const publishedAt = parseChapterPublishedAt(payload.latestChapter);
    if (!publishedAt || !isChapterWithinHomeWindow(publishedAt, now)) continue;
    results.push({
      ...payload,
      publishedAt,
      isNew: isLatestChapterUnread(payload.item, payload.latestChapter, readingHistory),
      trackedBy: item.trackedBy,
    });
  }

  return {
    entries: results
      .sort((left, right) => new Date(right.publishedAt) - new Date(left.publishedAt))
      .slice(0, limit),
    trackedCount: tracked.length,
  };
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

  if (!skipCache) {
    const cached = peekHomeLatestChapters({
      mediaFilter,
      trackedCount: tracked.length,
      limit,
    });
    if (cached) return cached;
  }

  const storedFirstSeen = await kvGet(FIRST_SEEN_KEY, {});
  const firstSeenMap = pruneFirstSeenMap(storedFirstSeen);
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

  const nextFirstSeen = pruneFirstSeenMap(firstSeenMap, now);
  if (JSON.stringify(storedFirstSeen) !== JSON.stringify(nextFirstSeen)) {
    await kvSet(FIRST_SEEN_KEY, nextFirstSeen);
  }

  const entries = results
    .sort((left, right) => new Date(right.publishedAt) - new Date(left.publishedAt))
    .slice(0, limit);

  const payload = { entries, trackedCount: tracked.length };
  homeLatestResultCache = {
    key: buildHomeLatestCacheKey(mediaFilter, tracked.length, limit),
    at: Date.now(),
    data: payload,
  };
  return payload;
}

export function clearHomeLatestChaptersCache() {
  homeLatestResultCache = null;
}
