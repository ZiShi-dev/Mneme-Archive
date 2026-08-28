export const CATALOG_RECENT_LIMIT = 2;

export function normalizeRecentChapters(chapters = [], limit = CATALOG_RECENT_LIMIT) {
  const seen = new Set();
  const results = [];
  for (const chapter of chapters) {
    if (!chapter?.url) continue;
    const key = chapter.url;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      number: String(chapter.number ?? chapter.name ?? ""),
      name: String(chapter.name ?? chapter.number ?? ""),
      url: chapter.url,
      date: chapter.date || "",
      locked: Boolean(chapter.locked),
      ...(chapter.contentApi ? { contentApi: chapter.contentApi } : {}),
    });
    if (results.length >= limit) break;
  }
  return results;
}

export function recentChaptersFromCount(total, buildUrl, limit = CATALOG_RECENT_LIMIT) {
  const max = Math.floor(Number(total));
  if (!max || max < 1 || typeof buildUrl !== "function") return [];
  const chapters = [];
  for (let number = max; number >= 1 && chapters.length < limit; number -= 1) {
    const url = buildUrl(number);
    if (!url) continue;
    chapters.push({ number: String(number), name: String(number), url });
  }
  return normalizeRecentChapters(chapters, limit);
}

export function applyRecentChapterFields(item, chapters = []) {
  const recentChapters = normalizeRecentChapters(chapters);
  const latest = recentChapters[0];
  return {
    ...item,
    recentChapters,
    latestChapter: latest?.number || item.latestChapter || "—",
    latestChapterUrl: latest?.url || item.latestChapterUrl || null,
  };
}

export async function enrichCatalogItems(items, {
  concurrency = 5,
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
