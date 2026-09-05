import { sortChaptersDesc } from "./chapterOrdering.js";
import { sanitizeRealmChapterLabel } from "./realmChapterLabels.js";

export const CATALOG_RECENT_LIMIT = 2;

/** Évite un fetch série/manifest quand la carte catalogue a déjà des chapitres cliquables. */
export function catalogNeedsRecentEnrich(item, minChapters = CATALOG_RECENT_LIMIT) {
  const count = item?.recentChapters?.length || 0;
  if (count >= minChapters) return false;
  if (item?.latestChapterUrl) return false;
  return count < minChapters;
}

function isRealmNovelCatalogSource(sourceId) {
  return String(sourceId || "").toLowerCase() === "realmnovel";
}

export function normalizeRecentChapters(chapters = [], limit = CATALOG_RECENT_LIMIT, { sourceId } = {}) {
  const realmOpen = isRealmNovelCatalogSource(sourceId);
  const seen = new Set();
  const results = [];
  for (const chapter of chapters) {
    if (!chapter?.url) continue;
    const key = chapter.url;
    if (seen.has(key)) continue;
    seen.add(key);
    const rawName = String(chapter.name ?? chapter.number ?? "");
    const entry = {
      number: String(chapter.number ?? chapter.name ?? ""),
      name: realmOpen ? sanitizeRealmChapterLabel(rawName) : rawName,
      url: chapter.url,
      date: chapter.date || "",
      locked: realmOpen ? false : Boolean(chapter.locked),
      ...(chapter.contentApi ? { contentApi: chapter.contentApi } : {}),
    };
    if (!realmOpen) {
      if (chapter.unlockAt) entry.unlockAt = chapter.unlockAt;
      if (chapter.price != null && chapter.price !== "") entry.price = chapter.price;
      if (chapter.permanentlyLocked) entry.permanentlyLocked = true;
    }
    results.push(entry);
    if (results.length >= limit) break;
  }
  return results;
}

/** Derniers chapitres d’une liste complète (souvent triée asc. côté serveur). */
export function recentChaptersFromList(chapters = [], limit = CATALOG_RECENT_LIMIT, options = {}) {
  if (!Array.isArray(chapters) || !chapters.length) return [];
  return normalizeRecentChapters(sortChaptersDesc(chapters), limit, options);
}

export function recentChaptersFromCount(total, buildUrl, limit = CATALOG_RECENT_LIMIT, options = {}) {
  const max = Math.floor(Number(total));
  if (!max || max < 1 || typeof buildUrl !== "function") return [];
  const chapters = [];
  for (let number = max; number >= 1 && chapters.length < limit; number -= 1) {
    const url = buildUrl(number);
    if (!url) continue;
    chapters.push({ number: String(number), name: String(number), url });
  }
  return normalizeRecentChapters(chapters, limit, options);
}

export function applyRecentChapterFields(item, chapters = []) {
  const recentChapters = normalizeRecentChapters(chapters, CATALOG_RECENT_LIMIT, { sourceId: item?.sourceId });
  const latest = recentChapters[0];
  return {
    ...item,
    recentChapters,
    latestChapter: latest?.number || item.latestChapter || "—",
    latestChapterUrl: latest?.url || item.latestChapterUrl || null,
  };
}

export async function enrichCatalogItems(items, {
  concurrency = 2,
  needsEnrich = (item) => (item.recentChapters?.length || 0) < CATALOG_RECENT_LIMIT,
  enrichItem,
} = {}) {
  if (!Array.isArray(items) || !enrichItem) return items;
  const queue = items.filter((item) => item?.url && needsEnrich(item));
  if (!queue.length) return items;

  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const item = queue[cursor++];
      try {
        const chapters = await enrichItem(item);
        if (!chapters?.length) continue;
        const enriched = applyRecentChapterFields(item, chapters);
        item.recentChapters = enriched.recentChapters;
        item.latestChapter = enriched.latestChapter;
        item.latestChapterUrl = enriched.latestChapterUrl;
      } catch {
        // Garde les chapitres déjà présents sur la carte.
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  await Promise.all(workers);
  return items;
}
