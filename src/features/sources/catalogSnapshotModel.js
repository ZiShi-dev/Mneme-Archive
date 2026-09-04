export const MAX_SNAPSHOT_ITEMS = 24;
export const MAX_RECENT_CHAPTERS = 2;

const COMPACT_ITEM_KEYS = [
  "altTitle",
  "subtitle",
  "mediaType",
  "mediaTypeLabel",
  "catalogStyle",
  "novelId",
  "latestChapter",
  "latestChapterUrl",
  "publishedAt",
  "chapterCount",
  "status",
  "sourceName",
];

function compactRecentChapter(chapter) {
  if (!chapter?.url) return null;
  return {
    number: chapter.number,
    name: chapter.name,
    url: chapter.url,
    publishedAt: chapter.publishedAt,
  };
}

export function compactCatalogItem(item) {
  if (!item || typeof item !== "object" || !item.url) return null;
  const compact = {
    url: item.url,
    title: item.title || "",
    cover: item.cover || "",
    sourceId: item.sourceId,
  };
  for (const key of COMPACT_ITEM_KEYS) {
    if (item[key] != null && item[key] !== "") compact[key] = item[key];
  }
  if (Array.isArray(item.authors) && item.authors.length) {
    compact.authors = item.authors.slice(0, 4);
  }
  if (Array.isArray(item.recentChapters) && item.recentChapters.length) {
    compact.recentChapters = item.recentChapters
      .slice(0, MAX_RECENT_CHAPTERS)
      .map(compactRecentChapter)
      .filter(Boolean);
  }
  return compact;
}

export function compactSnapshotItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map(compactCatalogItem).filter(Boolean).slice(0, MAX_SNAPSHOT_ITEMS);
}
