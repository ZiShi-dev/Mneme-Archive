function decodeChapterUrl(url = "") {
  let decoded = String(url || "");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the raw URL when decoding fails.
  }
  return decoded;
}

export function extractChapterNumberFromUrl(url = "") {
  const decoded = decodeChapterUrl(url);

  // AnimeDar et sources similaires : ?ep=N sur la même fiche anime
  try {
    const parsed = new URL(decoded, "https://local.invalid");
    const epQuery = parsed.searchParams.get("ep");
    if (epQuery && /^\d+(?:\.\d+)?$/.test(epQuery)) return epQuery;
    const episodeQuery = parsed.searchParams.get("episode");
    if (episodeQuery && /^\d+(?:\.\d+)?$/.test(episodeQuery)) return episodeQuery;
  } catch {
    // Ignore les URLs invalides.
  }

  // Realm Novel, WTR Lab, etc. : /chapter/N
  const pathIndex = decoded.match(/\/chapter\/(\d+(?:\.\d+)?)(?:[/?#]|$)/i)?.[1];
  if (pathIndex) return pathIndex;

  // Dilar : /reader/{series}/-/{N}
  const readerIndex = decoded.match(/\/reader\/[^/]+\/-\/([^/?#]+)(?:[/?#]|$)/i)?.[1];
  if (readerIndex && /^\d+(?:\.\d+)?$/.test(readerIndex)) return readerIndex;

  // Madara, AzoraFly, Galaxy, Cenele, etc.
  const slugIndex = decoded.match(/(?:الفصل|chapter|ch|فصل)[-_/]([0-9]+(?:\.[0-9]+)?)/i)?.[1]
    ?? decoded.match(/\/chapter-([0-9]+(?:\.[0-9]+)?)(?:[-/]|$)/i)?.[1];
  if (slugIndex) return slugIndex;

  // Kol Novel : z435ggye-{postId} n'est pas un numéro de chapitre.
  if (/z435ggye-\d+/i.test(decoded)) return "";

  // Novels Paradise : /{series-slug}-{N}/ (hors /series/)
  if (!/\/series\/[^/]+\/?(?:[?#]|$)/i.test(decoded)) {
    const paradiseSlug = decoded.match(/\/([^/?#]+)-(\d+(?:\.\d+)?)\/?(?:[?#]|$)/i)?.[2];
    if (paradiseSlug) return paradiseSlug;
  }

  return "";
}

function extractChapterNumberFromLabel(name = "") {
  const label = String(name || "").trim();
  const fromName = label.match(/(?:الفصل|chapter|ch\.?|ep\.?|episode)\s*#?\s*([0-9]+(?:\.[0-9]+)?)/i)
    ?? label.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  return fromName?.[1] ?? "";
}

function extractChapterNumberFromField(number = "") {
  return String(number ?? "").match(/^(\d+(?:\.\d+)?)$/)?.[1] ?? "";
}

export function extractChapterNumber(name = "", url = "") {
  const fromUrl = extractChapterNumberFromUrl(url);
  if (fromUrl) return fromUrl;

  const fromName = extractChapterNumberFromLabel(name);
  if (fromName) return fromName;

  return "";
}

export function chapterOrderIndex(chapter) {
  const fromUrl = Number(extractChapterNumberFromUrl(chapter?.url));
  if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl;

  const fromField = Number(extractChapterNumberFromField(chapter?.number));
  if (Number.isFinite(fromField) && fromField > 0) return fromField;

  return 0;
}

export function chapterSortKey(chapter) {
  return chapterOrderIndex(chapter);
}

export function normalizeChapterUrl(url = "") {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    parsed.hash = "";
    const epParam = parsed.searchParams.get("ep");
    const episodeParam = parsed.searchParams.get("episode");
    parsed.search = "";
    if (epParam && /^\d+(?:\.\d+)?$/.test(epParam)) {
      parsed.searchParams.set("ep", epParam);
    } else if (episodeParam && /^\d+(?:\.\d+)?$/.test(episodeParam)) {
      parsed.searchParams.set("episode", episodeParam);
    }
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

    const fromUrl = extractChapterNumberFromUrl(chapter.url);
    const fromField = extractChapterNumberFromField(chapter.number);
    const fromLabel = extractChapterNumberFromLabel(chapter.name);
    const number = fromUrl
      ? ((fromField && fromField !== fromUrl) ? fromUrl : (fromField || fromUrl))
      : (fromField || fromLabel);
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
