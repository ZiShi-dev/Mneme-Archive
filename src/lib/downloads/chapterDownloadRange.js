import { chapterOrderIndex, extractChapterNumber } from "../../../server/lib/chapterOrdering.js";

export function sortChaptersAsc(chapters = []) {
  return [...chapters].sort((left, right) => {
    const delta = chapterOrderIndex(left) - chapterOrderIndex(right);
    if (delta !== 0) return delta;
    return String(left?.url || "").localeCompare(String(right?.url || ""));
  });
}

export function resolveChapterNumber(chapter) {
  return extractChapterNumber(chapter?.name, chapter?.url)
    || String(chapter?.number || "").trim()
    || String(chapterOrderIndex(chapter) || "");
}

export function findChapterByNumber(chapters, rawNumber) {
  const target = String(rawNumber ?? "").trim();
  if (!target) return null;
  const targetNum = Number(target);
  return sortChaptersAsc(chapters).find((chapter) => {
    const number = resolveChapterNumber(chapter);
    if (number === target) return true;
    return Number.isFinite(targetNum) && Number(number) === targetNum;
  }) || null;
}

export function sliceChaptersInRange(chapters, fromUrl, toUrl) {
  const sorted = sortChaptersAsc(chapters);
  const fromIdx = sorted.findIndex((chapter) => chapter.url === fromUrl);
  const toIdx = sorted.findIndex((chapter) => chapter.url === toUrl);
  if (fromIdx < 0 || toIdx < 0) return [];
  const start = Math.min(fromIdx, toIdx);
  const end = Math.max(fromIdx, toIdx);
  return sorted.slice(start, end + 1);
}

export function chapterRangeOptionLabel(chapter, index = 0) {
  const number = resolveChapterNumber(chapter);
  const name = String(chapter?.name || "").trim();
  if (number && name && name !== number) return `${number} · ${name}`;
  if (number) return number;
  if (name) return name;
  return `#${index + 1}`;
}
