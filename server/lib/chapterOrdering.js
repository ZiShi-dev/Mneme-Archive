export function extractChapterNumber(name = "", url = "") {
  const label = String(name || "").trim();
  const fromName = label.match(/(?:الفصل|chapter|ch\.?|ep\.?|episode)\s*#?\s*([0-9]+(?:\.[0-9]+)?)/i)
    ?? label.match(/^([0-9]+(?:\.[0-9]+)?)/);
  if (fromName?.[1]) return fromName[1];

  let decoded = String(url || "");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the raw URL when decoding fails.
  }
  const fromUrl = decoded.match(/(?:الفصل|chapter|ch)[-_/]([0-9]+(?:\.[0-9]+)?)/i)
    ?? decoded.match(/\/chapter-([0-9]+(?:\.[0-9]+)?)(?:[-/]|$)/i);
  return fromUrl?.[1] ?? "";
}

export function chapterSortKey(chapter) {
  const extracted = extractChapterNumber(chapter?.name, chapter?.url);
  const primary = Number(extracted);
  if (Number.isFinite(primary)) return primary;
  const fallback = Number(String(chapter?.number ?? "").match(/(\d+(?:\.\d+)?)/)?.[1]);
  return Number.isFinite(fallback) ? fallback : 0;
}

export function normalizeChapterUrl(url = "") {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return parsed.toString();
  } catch {
    return String(url || "").trim();
  }
}

function chapterVariantScore(chapter) {
  const publishedAt = chapter?.publishedAt ? new Date(chapter.publishedAt).getTime() : 0;
  let score = Number.isFinite(publishedAt) ? publishedAt : 0;
  const url = String(chapter?.url || "").toLowerCase();
  if (!/-raw(?:\/|$)/.test(url)) score += 0.25;
  return score;
}

export function dedupeChapters(chapters = []) {
  const byNumber = new Map();
  const withoutNumber = [];
  const seenUrls = new Set();

  for (const chapter of chapters) {
    if (!chapter?.url) continue;
    const urlKey = normalizeChapterUrl(chapter.url);
    if (seenUrls.has(urlKey)) continue;
    seenUrls.add(urlKey);

    const number = extractChapterNumber(chapter.name, chapter.url);
    const normalized = {
      ...chapter,
      number: number || String(chapter.number || chapter.name || "").trim(),
      name: String(chapter.name || chapter.number || number || "").trim(),
    };

    if (!number) {
      withoutNumber.push(normalized);
      continue;
    }

    const existing = byNumber.get(number);
    if (!existing || chapterVariantScore(normalized) >= chapterVariantScore(existing)) {
      byNumber.set(number, normalized);
    }
  }

  return [...byNumber.values(), ...withoutNumber];
}

export function sortChaptersDesc(chapters = []) {
  return [...chapters].sort((left, right) => {
    const diff = chapterSortKey(right) - chapterSortKey(left);
    if (diff !== 0) return diff;
    return String(right.url || "").localeCompare(String(left.url || ""), undefined, { numeric: true });
  });
}

export function normalizeChapterList(chapters = []) {
  return sortChaptersDesc(dedupeChapters(chapters));
}
