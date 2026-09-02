import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createHostContext } from "../lib/sourceBaseUrl.js";

export const DEFAULT_BASE_URL = "https://www.wiflix.tv";
export const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);

export function wiflixContext(baseUrl = DEFAULT_BASE_URL) {
  return baseUrl === DEFAULT_CTX.baseUrl ? DEFAULT_CTX : createHostContext(baseUrl);
}

export const SOURCE_NAME = "Wiflix";
export const SOURCE_ID = "wiflix";
export const MOVIES_PATH = "/film-en-streaming/";
export const SERIES_PATH = "/serie-en-streaming/";
export const MIXED_PATH = "/all/";
export const WIFLIX_UPSTREAM_PAGE_HINT = 24;

export const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const IMAGE_HOSTS = new Set([DEFAULT_CTX.apex, DEFAULT_CTX.hostname, `www.${DEFAULT_CTX.apex}`]);

export function assertWiflixStreamReferer(rawUrl = "", ctx = DEFAULT_CTX) {
  const decoded = decodeHtml(String(rawUrl || "").trim());
  if (!decoded) throw new Error("مرجع البث غير صالح");
  let url;
  try {
    url = new URL(decoded, ctx.baseUrl);
  } catch {
    throw new Error("مرجع البث غير صالح");
  }
  if (url.protocol !== "https:" || !isAllowedHost(url.hostname, ctx)) {
    throw new Error("مرجع البث غير صالح");
  }
  url.hash = "";
  return url.toString();
}

export function isAllowedHost(hostname = "", ctx = DEFAULT_CTX) {
  return ctx.allowedHosts.has(String(hostname).toLowerCase());
}

export function normalizeWiflixUrl(rawUrl = "", ctx = DEFAULT_CTX) {
  const decoded = decodeHtml(rawUrl);
  if (!decoded) return "";
  try {
    const url = new URL(decoded, ctx.baseUrl);
    if (url.protocol !== "https:" || !isAllowedHost(url.hostname, ctx)) return "";
    url.hostname = ctx.hostname;
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return "";
  }
}

export function assertWiflixHost(rawUrl, ctx = DEFAULT_CTX) {
  const normalized = normalizeWiflixUrl(rawUrl, ctx);
  if (!normalized) throw new Error("المصدر غير مسموح");
  return new URL(normalized);
}

export function watchSlugFromUrl(rawUrl = "", ctx = DEFAULT_CTX) {
  try {
    const url = new URL(normalizeWiflixUrl(rawUrl, ctx) || String(rawUrl || ""), ctx.baseUrl);
    return url.pathname.match(/^\/watch\/([a-z0-9-]+)$/i)?.[1] || "";
  } catch {
    return "";
  }
}

export function assertWatchUrl(rawUrl, ctx = DEFAULT_CTX) {
  const url = assertWiflixHost(rawUrl, ctx);
  const slug = watchSlugFromUrl(url.toString(), ctx);
  if (!slug) throw new Error("رابط Wiflix غير صالح");
  return `${ctx.baseUrl}/watch/${slug}`;
}

export function episodeNumberFromUrl(rawUrl = "", ctx = DEFAULT_CTX) {
  try {
    const url = new URL(String(rawUrl || ""), ctx.baseUrl);
    const episode = url.searchParams.get("episode");
    return /^\d+$/.test(episode || "") ? episode : "";
  } catch {
    return "";
  }
}

export function episodeLanguageFromUrl(rawUrl = "", ctx = DEFAULT_CTX) {
  try {
    const url = new URL(String(rawUrl || ""), ctx.baseUrl);
    const language = String(url.searchParams.get("language") || "").toUpperCase();
    if (language === "VOSTFR") return "VOSTFR";
    if (language === "VF") return "VF";
    return "";
  } catch {
    return "";
  }
}

export function assertChapterUrl(rawUrl, ctx = DEFAULT_CTX) {
  const canonical = assertWatchUrl(rawUrl, ctx);
  const episode = episodeNumberFromUrl(rawUrl, ctx);
  if (!episode) return canonical;
  const language = episodeLanguageFromUrl(rawUrl, ctx) === "VOSTFR" ? "VOSTFR" : "VF";
  return `${canonical}?language=${language}&episode=${episode}`;
}

export function episodeUrl(seasonUrl, number, language = "VF", ctx = DEFAULT_CTX) {
  const lang = String(language).toUpperCase() === "VOSTFR" ? "VOSTFR" : "VF";
  return `${assertWatchUrl(seasonUrl, ctx)}?language=${lang}&episode=${Number(number)}`;
}

export function assertWiflixImageUrl(rawUrl, ctx = DEFAULT_CTX) {
  const decoded = decodeHtml(rawUrl);
  let url;
  try {
    url = new URL(decoded, ctx.baseUrl);
  } catch {
    throw new Error("رابط الصورة غير مسموح");
  }
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("رابط الصورة غير مسموح");
  }
  if (!/^\/(?:poster|static)\//i.test(url.pathname)) {
    throw new Error("رابط الصورة غير مسموح");
  }
  url.hostname = ctx.hostname;
  url.hash = "";
  return url.toString();
}

export function assertFilterPath(rawPath = MIXED_PATH) {
  const path = String(rawPath || MIXED_PATH).trim();
  if (!path.startsWith("/") || path.includes("..") || path.includes("://")) {
    throw new Error("مسار فلتر Wiflix غير صالح");
  }
  const normalized = path.endsWith("/") ? path : `${path}/`;
  if (normalized === MIXED_PATH) return MIXED_PATH;
  if (normalized === MOVIES_PATH || normalized === SERIES_PATH) return normalized;
  if (/^\/genre\/[a-z0-9&%_.-]+\/$/i.test(normalized)) return normalized;
  if (/^\/annee\/\d{4}\/$/i.test(normalized)) return normalized;
  throw new Error("مسار فلتر Wiflix غير صالح");
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

export function absoluteMediaUrl(raw = "", ctx = DEFAULT_CTX) {
  const decoded = decodeHtml(raw);
  if (!decoded) return "";
  try {
    const url = new URL(decoded, ctx.baseUrl);
    if (url.protocol !== "https:" || !isAllowedHost(url.hostname, ctx)) return "";
    url.hostname = ctx.hostname;
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function normalizeWiflixAudioLabel(raw = "") {
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

export function isSeriesCard(block = "", title = "") {
  return /block-sai|block-ep/i.test(block) || /saison\s+\d+/i.test(title);
}

export function parseLatestEpisode(block = "") {
  const text = textOnly(block.match(/<div class="block-ep">([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function seriesCatalogChapters(seasonUrl, latestEpisode, ctx = DEFAULT_CTX) {
  const latest = Number(latestEpisode) > 0 ? Number(latestEpisode) : 1;
  const chapters = [watchEntry(episodeUrl(seasonUrl, latest, "VF", ctx), String(latest))];
  if (latest > 1) chapters.push(watchEntry(episodeUrl(seasonUrl, latest - 1, "VF", ctx), String(latest - 1)));
  return chapters;
}

export function isMixedCatalogPath(filterPath = "") {
  return filterPath === MIXED_PATH;
}

export function catalogHasMore(html, page) {
  return new RegExp(`[?&]page=${page + 1}\\b`).test(html);
}

export function buildCatalogUrl(page, filterPath = MIXED_PATH, baseUrl = DEFAULT_BASE_URL) {
  const path = assertFilterPath(filterPath);
  const trimmed = path.replace(/\/+$/, "");
  if (page <= 1) return `${baseUrl}${path}`;
  return `${baseUrl}${trimmed}?page=${page}`;
}

export function buildSearchUrl(query, page = 1, baseUrl = DEFAULT_BASE_URL) {
  const params = new URLSearchParams({ keywords: query });
  if (page > 1) params.set("page", String(page));
  return `${baseUrl}/search?${params}`;
}

export function toggleEpisodeLanguage(chapterUrl, ctx = DEFAULT_CTX) {
  const episode = episodeNumberFromUrl(chapterUrl, ctx);
  if (!episode) return "";
  const next = episodeLanguageFromUrl(chapterUrl, ctx) === "VOSTFR" ? "VF" : "VOSTFR";
  return episodeUrl(chapterUrl, episode, next, ctx);
}
