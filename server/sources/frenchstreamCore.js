import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createHostContext } from "../lib/sourceBaseUrl.js";

export const DEFAULT_BASE_URL = "https://french-stream.one";
export const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
export const SOURCE_NAME = "French Stream";
export const SOURCE_ID = "frenchstream";
export const CATALOG_PATH = "/films/";
export const SERIES_PATH = "/s-tv/";
export const MIXED_PATH = "/all/";
export const FRENCH_STREAM_UPSTREAM_PAGE_HINT = 24;

export const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export function isAllowedHost(hostname = "", ctx = DEFAULT_CTX) {
  return ctx.allowedHosts.has(String(hostname).toLowerCase());
}

export function normalizeFrenchStreamUrl(rawUrl = "", ctx = DEFAULT_CTX) {
  const decoded = decodeHtml(rawUrl);
  if (!decoded) return "";
  try {
    const url = new URL(decoded, ctx.baseUrl);
    if (url.protocol !== "https:" || !isAllowedHost(url.hostname, ctx)) return "";
    url.hostname = ctx.apex;
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function newsIdFromUrl(rawUrl = "") {
  const url = new URL(normalizeFrenchStreamUrl(rawUrl) || "https://invalid.local/");
  const fromQuery = url.searchParams.get("newsid");
  if (/^\d+$/.test(fromQuery || "")) return fromQuery;
  const pretty = url.pathname.match(/^\/(\d+)-[^/]+\.html$/i);
  return pretty ? pretty[1] : "";
}

export function assertFrenchStreamHost(rawUrl) {
  const normalized = normalizeFrenchStreamUrl(rawUrl);
  if (!normalized) throw new Error("المصدر غير مسموح");
  return new URL(normalized);
}

export function assertMovieUrl(rawUrl) {
  const url = assertFrenchStreamHost(rawUrl);
  const newsId = newsIdFromUrl(url.toString());
  if (!newsId) throw new Error("رابط French Stream غير صالح");
  return `${DEFAULT_BASE_URL}/index.php?newsid=${newsId}`;
}

export function episodeNumberFromUrl(rawUrl = "") {
  try {
    const url = new URL(normalizeFrenchStreamUrl(rawUrl) || String(rawUrl || ""));
    const fromQuery = url.searchParams.get("ep");
    if (/^\d+$/.test(fromQuery || "")) return fromQuery;
    const fromHash = String(url.hash || "").match(/ep=(\d+)/i)?.[1];
    return /^\d+$/.test(fromHash || "") ? fromHash : "";
  } catch {
    return "";
  }
}

export function assertChapterUrl(rawUrl) {
  const canonical = assertMovieUrl(rawUrl);
  const episode = episodeNumberFromUrl(rawUrl);
  return episode ? `${canonical}&ep=${episode}` : canonical;
}

export function episodeUrl(seasonUrl, number) {
  return `${assertMovieUrl(seasonUrl)}&ep=${Number(number)}`;
}

export function assertFilterPath(rawPath = CATALOG_PATH) {
  const path = String(rawPath || CATALOG_PATH).trim();
  if (!path.startsWith("/") || path.includes("..") || path.includes("://")) {
    throw new Error("مسار فلتر French Stream غير صالح");
  }
  const normalized = path.endsWith("/") ? path : `${path}/`;
  if (normalized === MIXED_PATH) return MIXED_PATH;
  if (/^\/films\/(?:[a-z0-9-]+\/)?$/i.test(normalized)) return normalized;
  if (/^\/s-tv\/(?:[a-z0-9-]+\/)?$/i.test(normalized)) return normalized;
  if (/^\/(?:[a-z0-9-]*series?[a-z0-9-]*|streaming-tv-realits)\/$/i.test(normalized)) return normalized;
  if (/^\/xfsearch\/[a-z0-9+_.%-]+\/[a-z0-9+_.%-]+\/$/i.test(normalized)) return normalized;
  throw new Error("مسار فلتر French Stream غير صالح");
}

export function watchEntry(url, label = "1") {
  return {
    url,
    name: String(label || "1"),
    number: String(label || "1"),
    date: "",
    locked: false,
  };
}

export function isSeriesCard(block = "") {
  return /mli-eps|version-serie|s-tv|saison/i.test(block);
}

export function isSeriesSearchHit(url = "", title = "", block = "") {
  if (/film/i.test(url)) return false;
  return /saison|s-tv|(?:^|[^a-z])serie/i.test(`${url} ${title} ${block}`);
}

export function normalizeFrenchStreamAudioLabel(raw = "") {
  const text = String(raw || "").toUpperCase().replace(/\s+/g, "");
  if (!text) return "";
  const hasVost = /VOST/.test(text);
  const hasVf = /VF/.test(text);
  const hasFrenchLabel = /^(TRUE)?FRENCH$/.test(text);
  if (hasVf && hasVost) return "VF+VOSTFR";
  if (hasVost) return "VOSTFR";
  if (hasVf || hasFrenchLabel) return "VF";
  if (text === "VO" || /(?:^|\+)VO(?:\+|$)/.test(text)) return "VO";
  return "";
}

export function seriesCatalogChapters(seasonUrl, latestEpisode) {
  const latest = Number(latestEpisode) > 0 ? Number(latestEpisode) : 1;
  const chapters = [watchEntry(episodeUrl(seasonUrl, latest), String(latest))];
  if (latest > 1) chapters.push(watchEntry(episodeUrl(seasonUrl, latest - 1), String(latest - 1)));
  return chapters;
}

export function parseEpisodeProgress(block = "") {
  const text = textOnly(block.match(/<span class="mli-eps">([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const match = text.match(/ep\s*(\d+)\s*(?:sur|\/)\s*(\d+)/i);
  if (!match) return { latest: 0, total: 0 };
  return { latest: Number(match[1]), total: Number(match[2]) };
}

export function parseCardVersion(block = "") {
  return textOnly(block.match(/<span class="film-version">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
}

export function isMixedCatalogPath(filterPath = "") {
  return filterPath === MIXED_PATH;
}
