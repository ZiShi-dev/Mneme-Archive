export function isOfflineNovelChapter(data) {
  return data?.kind === "novel" && Array.isArray(data.paragraphs) && data.paragraphs.length > 0;
}

export function isOfflineMangaChapter(data) {
  if (!data || !Array.isArray(data.pages) || data.pages.length === 0) return false;
  if (data.kind === "novel" || isOfflineNovelChapter(data)) return false;
  if (data.kind === "manga") return true;
  return !Array.isArray(data.paragraphs) || data.paragraphs.length === 0;
}

export function isOfflineChapter(data) {
  return isOfflineNovelChapter(data) || isOfflineMangaChapter(data);
}
