import { publicFetch } from "../lib/publicFetch.js";
import { decodeHtml, mergeFilterGroups, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { fetchProxiedHlsResource, isAdSegmentUrl } from "../lib/hlsProxy.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/responseJson.js";
import {
  applyRecentChapterFields,
  catalogNeedsRecentEnrich,
  enrichCatalogItems,
  normalizeRecentChapters,
  recentChaptersFromList,
} from "../lib/catalogChapters.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";

const DEFAULT_BASE_URL = "https://4h.b9p2m6c.shop";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
const SOURCE_NAME = "Anime4up";
const SOURCE_ID = "anime4up";
const CATALOG_PATH = "/قائمة-الانمي/";
const HOME_PATH = "/home8/";
/** Même densité que AnimeDar. */
export const ANIME4UP_CATALOG_PAGE_SIZE = 20;
const ANIME4UP_FILTERS_CACHE_TTL_MS = 30 * 60_000;
const ANIME4UP_SERIES_EPISODES_CACHE_TTL_MS = 5 * 60_000;
const anime4upFiltersCache = new Map();
const anime4upSeriesEpisodesCache = new Map();

const ANIME4UP_HOST_PATTERN = /(?:^|\.)anime4up\.rest$/i;
const ANIME4UP_SITE_MIRROR_PATTERN = /^\d[a-z0-9]\.[a-z0-9]+\.shop$/i;
const ANIME4UP_STREAM_HOST_PATTERN = /\.k1c6x8p\.shop$/i;

function buildAnime4upStreamProxyPath(targetUrl, referer = "") {
  const params = new URLSearchParams({ url: targetUrl });
  if (referer) params.set("referer", referer);
  return `/api/sources/anime4up/stream?${params}`;
}

function assertAnime4upStreamUrl(rawUrl = "") {
  const decoded = decodeHtml(rawUrl);
  if (!decoded) throw new Error("رابط البث غير صالح");
  const url = new URL(decoded);
  if (url.protocol !== "https:" || !ANIME4UP_STREAM_HOST_PATTERN.test(url.hostname)) {
    throw new Error("مصدر البث غير مسموح");
  }
  url.hash = "";
  return url.toString();
}

function assertAnime4upStreamReferer(rawUrl = "") {
  const normalized = normalizeAnime4upUrl(rawUrl, { keepHost: true });
  if (!normalized) throw new Error("مرجع البث غير صالح");
  return normalized;
}

function assertAnime4upSubtitleUrl(rawUrl = "") {
  const decoded = decodeHtml(rawUrl);
  if (!decoded) throw new Error("رابط الترجمة غير صالح");
  const url = new URL(decoded);
  if (url.protocol !== "https:" || !isAllowedAnime4upHost(url.hostname)) {
    throw new Error("مصدر الترجمة غير مسموح");
  }
  const path = url.pathname.toLowerCase();
  if (!/\/vnx-subtitle\/|\/wp-content\/uploads\//i.test(path)) {
    throw new Error("رابط الترجمة غير صالح");
  }
  if (!/\.(?:vtt|srt)$/i.test(path)) {
    throw new Error("صيغة الترجمة غير مدعومة");
  }
  url.hash = "";
  return url.toString();
}

async function fetchProxiedSubtitle(target, referer = "") {
  const response = await publicFetch(target, {
    headers: {
      accept: "text/vtt, text/plain, */*",
      referer,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) throw new Error(`ترجمة Anime4up indisponible (${response.status})`);
  const buffer = new Uint8Array(await response.arrayBuffer());
  return {
    kind: "stream",
    contentType: "text/vtt; charset=utf-8",
    buffer,
    cacheControl: "public, max-age=3600",
  };
}

function isAllowedAnime4upHost(hostname = "", ctx = DEFAULT_CTX) {
  const host = String(hostname).toLowerCase();
  return host === ctx.hostname
    || host === ctx.apex
    || host === `www.${ctx.apex}`
    || ANIME4UP_HOST_PATTERN.test(host)
    || ANIME4UP_SITE_MIRROR_PATTERN.test(host);
}

export function normalizeAnime4upUrl(rawUrl = "", { keepHost = false, ctx = DEFAULT_CTX } = {}) {
  const decoded = decodeHtml(rawUrl);
  if (!decoded) return "";
  try {
    const url = new URL(decoded, ctx.baseUrl);
    if (url.protocol !== "https:" || !isAllowedAnime4upHost(url.hostname, ctx)) return "";
    if (!keepHost) url.hostname = ctx.hostname;
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function canonicalAnime4upHtml(html = "", baseUrl = DEFAULT_BASE_URL) {
  return html
    .replace(/https?:\/\/[^"/]+\/wp-content/gi, `${baseUrl}/wp-content`)
    .replace(/https?:\/\/w1\.anime4up\.rest/gi, baseUrl)
    .replace(/https?:\/\/www\.anime4up\.rest/gi, baseUrl)
    .replace(/https?:\/\/anime4up\.rest/gi, baseUrl)
    .replace(/https?:\/\/\d[a-z0-9]\.[a-z0-9]+\.shop/gi, baseUrl);
}

function createAnime4upFetcher(baseUrl = DEFAULT_BASE_URL) {
  return createCachedHtmlFetcher({
    ttlMs: 3 * 60_000,
    timeoutMs: 40_000,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ar,en;q=0.8",
      referer: `${baseUrl}/`,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    getVariants: (url) => [url],
    buildError: (lastStatus) => `Anime4up a répondu ${lastStatus || "sans réponse"}`,
  });
}

function assertAnime4upHost(rawUrl, ctx = DEFAULT_CTX) {
  const normalized = normalizeAnime4upUrl(rawUrl, { ctx });
  if (!normalized) throw new Error("المصدر غير مسموح");
  const url = new URL(normalized);
  url.hostname = ctx.hostname;
  url.hash = "";
  return url;
}

function assertAnime4upImageUrl(rawUrl) {
  const decoded = decodeHtml(String(rawUrl).trim());
  if (!decoded) throw new Error("رابط الصورة غير مسموح");
  const url = new URL(decoded, DEFAULT_BASE_URL);
  if (url.protocol !== "https:" || !isAllowedAnime4upHost(url.hostname)) {
    throw new Error("رابط الصورة غير مسموح");
  }
  if (!url.pathname.startsWith("/wp-content/uploads/")) throw new Error("رابط الصورة غير مسموح");
  url.hash = "";
  return url.toString();
}

async function fetchAnime4upProxiedImage(rawUrl) {
  const target = assertAnime4upImageUrl(rawUrl);
  const origin = `${new URL(target).origin}/`;
  const referers = [...new Set([
    origin,
    `${DEFAULT_BASE_URL}/`,
    "https://w1.anime4up.rest/",
  ])];
  let lastError;
  for (const referer of referers) {
    try {
      return await fetchProxiedImage(target, referer, SOURCE_NAME);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Image Anime4up indisponible");
}

function assertAnimeUrl(rawUrl, ctx = DEFAULT_CTX) {
  const url = assertAnime4upHost(rawUrl, ctx);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "anime" || !parts[1] || parts[1] === "page") throw new Error("رابط أنمي Anime4up غير صالح");
  return `${String(ctx.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "")}/anime/${parts[1]}/`;
}

function assertEpisodeUrl(rawUrl, ctx = DEFAULT_CTX) {
  const url = assertAnime4upHost(rawUrl, ctx);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "episode" || !parts[1]) throw new Error("رابط حلقة Anime4up غير صالح");
  return url.toString();
}

function slugFromAnimeUrl(rawUrl) {
  const url = assertAnime4upHost(rawUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "anime" && parts[1]) return parts[1];
  throw new Error("رابط Anime4up غير صالح");
}

export function extractLatestEpisodesHtml(html = "") {
  const gridStart = html.search(/<div[^>]*id=["']wa-latest-episodes-grid["']/i);
  if (gridStart < 0) return "";
  const slice = html.slice(gridStart);
  const gridOpenEnd = slice.indexOf(">");
  if (gridOpenEnd < 0) return "";
  const innerStart = gridStart + gridOpenEnd + 1;
  let depth = 1;
  let index = innerStart;
  while (index < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", index);
    const nextClose = html.indexOf("</div>", index);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      index = nextOpen + 4;
      continue;
    }
    depth -= 1;
    index = nextClose + 6;
  }
  return depth === 0 ? html.slice(innerStart, index - 6) : "";
}

function episodeNumberFromText(text = "") {
  const label = textOnly(text);
  const numeric = label.match(/(?:الحلقة|episode)\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (numeric) return numeric[1];
  const tail = label.match(/الحلقة\s+(.+)/i);
  return tail ? tail[1].trim() : "";
}

function episodeLabelFields(rawLabel = "", url = "") {
  const label = textOnly(rawLabel);
  const number = episodeNumberFromText(label) || episodeNumberFromUrl(url);
  const display = number || label || "—";
  return { number: display, name: display };
}

function episodeSortKey(number = "") {
  const match = String(number).match(/(\d+(?:\.\d+)?)(?!.*\d)/);
  return match ? Number(match[1]) : 0;
}

const PLACEHOLDER_COVER_RE = /\/images\.png$|Anime4up-Icon|\/favicon/i;
const PREFERRED_EMBED_HOSTS = [
  /voe\.sx/i,
  /share4max\.(com|org)/i,
  /uqload\./i,
  /vkvideo\.ru/i,
  /rubyvidhub\.com/i,
  /playmogo\.com/i,
  /mp4upload\.com/i,
];

export function normalizeAnime4upEmbedUrl(rawUrl = "") {
  const decoded = decodeHtml(String(rawUrl).replace(/&amp;/g, "&")).trim();
  if (!decoded) return "";
  try {
    const parsed = new URL(decoded);
    if (/^share4max\.com$/i.test(parsed.hostname)) {
      parsed.hostname = "share4max.org";
    }
    if (/^mp4upload\.com$/i.test(parsed.hostname)) {
      parsed.hostname = "www.mp4upload.com";
    }
    return parsed.toString();
  } catch {
    return decoded;
  }
}

export function sortAnime4upSources(sources = []) {
  const ranked = [];
  const seen = new Set();

  for (const entry of sources) {
    const key = normalizeAnime4upEmbedUrl(entry.url);
    if (!key || seen.has(key) || !isAnime4upNativePlayerUrl(key)) continue;
    seen.add(key);
    ranked.push({ ...entry, url: key });
  }

  for (const pattern of PREFERRED_EMBED_HOSTS) {
    for (const entry of sources) {
      const key = normalizeAnime4upEmbedUrl(entry.url);
      if (!key || seen.has(key) || !pattern.test(key)) continue;
      seen.add(key);
      ranked.push({ ...entry, url: key });
    }
  }
  for (const entry of sources) {
    const key = normalizeAnime4upEmbedUrl(entry.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ranked.push({ ...entry, url: key });
  }
  return ranked;
}

function isAnime4upNativePlayerUrl(url = "") {
  return /Anime4up-S[12]/i.test(url);
}

function isPlaceholderCover(rawUrl = "") {
  return !rawUrl || PLACEHOLDER_COVER_RE.test(rawUrl);
}

export function parseAnime4upCover(html) {
  const thumbBlock = html.match(/<div[^>]*class="[^"]*anime-thumbnail[^"]*"[^>]*>[\s\S]*?<\/div>/i)?.[0] ?? "";
  const thumbSrc = thumbBlock.match(/<img[^>]*\b(?:data-image|src)="([^"]+)"/i)?.[1];
  if (thumbSrc && !isPlaceholderCover(thumbSrc)) {
    const normalized = normalizeAnime4upUrl(thumbSrc, { keepHost: true }) || normalizeAnime4upUrl(thumbSrc);
    if (normalized) return normalized;
  }

  for (const match of html.matchAll(/<img[^>]*class="[^"]*thumbnail[^"]*img-responsive[^"]*"[^>]*>/gi)) {
    const src = match[0].match(/\b(?:data-image|src)="([^"]+)"/i)?.[1];
    if (src && !isPlaceholderCover(src)) {
      const normalized = normalizeAnime4upUrl(src, { keepHost: true }) || normalizeAnime4upUrl(src);
      if (normalized) return normalized;
    }
  }

  const infoBlock = html.match(/<div[^>]*class="[^"]*anime-info-container[^"]*"[\s\S]*?<div[^>]*class="[^"]*anime-details"/i)?.[0] ?? "";
  const uploads = infoBlock.match(/\b(?:data-image|src)="(https:\/\/[^"]*\/wp-content\/uploads\/[^"]+)"/i)?.[1];
  if (uploads && !isPlaceholderCover(uploads)) {
    const normalized = normalizeAnime4upUrl(uploads, { keepHost: true }) || normalizeAnime4upUrl(uploads);
    if (normalized) return normalized;
  }

  const og = html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ?? "";
  if (og && !isPlaceholderCover(og)) {
    const normalized = normalizeAnime4upUrl(og, { keepHost: true }) || normalizeAnime4upUrl(og);
    if (normalized) return normalized;
  }
  return "";
}

export function pickAnime4upExternalEmbedUrl(sources = []) {
  const normalized = sortAnime4upSources(sources);
  const external = normalized.filter((entry) => !isAnime4upNativePlayerUrl(entry.url));
  for (const pattern of PREFERRED_EMBED_HOSTS) {
    const match = external.find((entry) => pattern.test(entry.url));
    if (match) return match.url;
  }
  return external[0]?.url || "";
}

export function pickAnime4upEmbedUrl(sources, episodePageUrl) {
  return pickAnime4upExternalEmbedUrl(sources) || episodePageUrl || "";
}

function episodeNumberFromUrl(url = "") {
  const decoded = decodeURIComponent(url);
  const match = decoded.match(/(?:الحلقة|episode)[-_ ]?([0-9]+(?:\.[0-9]+)?)/i);
  return match ? match[1] : "";
}

function resolveMediaType(typeLabel = "") {
  const label = textOnly(typeLabel);
  if (/فيلم|movie/i.test(label)) {
    return { mediaType: "movie", mediaTypeLabel: label || "فيلم" };
  }
  return { mediaType: "anime", mediaTypeLabel: label || "أنمي" };
}

function parseCardType(block = "") {
  const linked = block.match(/<div[^>]*class="[^"]*anime-card-type[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
  if (linked) return textOnly(linked[1]);
  const plain = block.match(/<div[^>]*class="[^"]*anime-card-type[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  return textOnly(plain?.[1] ?? "");
}

function parseCardCover(block = "") {
  const imgTag = block.match(/<img[^>]*>/i)?.[0] ?? "";
  const raw = decodeHtml(imgTag.match(/data-image="([^"]+)"/i)?.[1] ?? imgTag.match(/src="([^"]+)"/i)?.[1] ?? "");
  const normalized = normalizeAnime4upUrl(raw, { keepHost: true }) || normalizeAnime4upUrl(raw);
  if (!normalized || isPlaceholderCover(normalized)) return "";
  return normalized;
}

function parseCardAnimeLink(block = "") {
  const titleLink = block.match(/<div[^>]*class="[^"]*anime-card-title[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"/i);
  if (titleLink) return normalizeAnime4upUrl(titleLink[1]);
  const overlay = block.match(/<a[^>]*class="[^"]*overlay[^"]*"[^>]*href="([^"]*\/anime\/[^"?#]+\/?)"/i);
  return overlay ? normalizeAnime4upUrl(overlay[1]) : "";
}

function parseCardEpisodeLink(block = "") {
  const epLink = block.match(/<div[^>]*class="[^"]*ep_num[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"/i);
  return epLink ? decodeHtml(epLink[1]) : "";
}

function parseCardEpisodeLinks(block = "") {
  const episodes = [];
  for (const match of block.matchAll(/<div[^>]*class="[^"]*ep_num[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const episodeUrl = normalizeAnime4upUrl(match[1]);
    const episodeMeta = episodeLabelFields(match[2], episodeUrl);
    if (!episodeUrl || !episodeMeta.number) continue;
    episodes.push({
      url: episodeUrl,
      name: episodeMeta.name,
      number: episodeMeta.number,
    });
  }
  return normalizeRecentChapters(episodes);
}

export function parseAnime4upCatalog(html) {
  const results = [];
  const starts = [...html.matchAll(/<div class="anime-card-themex">/gi)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const animeUrl = parseCardAnimeLink(block);
    if (!animeUrl || !/\/anime\/[^/]+\/?$/i.test(animeUrl)) return;
    const titleMatch = block.match(/<div[^>]*class="[^"]*anime-card-title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const title = textOnly(titleMatch?.[1] ?? block.match(/<img[^>]*alt="([^"]+)"/i)?.[1] ?? "");
    if (!title) return;
    const recentChapters = parseCardEpisodeLinks(block);
    const typeLabel = parseCardType(block);
    const media = resolveMediaType(typeLabel);
    const summary = decodeHtml(block.match(/data-content="([^"]+)"/i)?.[1] ?? "");
    results.push(applyRecentChapterFields({
      id: slugFromAnimeUrl(animeUrl),
      title,
      altTitle: "",
      url: animeUrl,
      cover: parseCardCover(block),
      summary,
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      audioLabel: "مترجم",
      ...media,
    }, recentChapters));
  });
  return results;
}

export function parseAnime4upEpisodes(html) {
  const episodes = [];
  const seen = new Set();
  const add = (rawUrl, label = "") => {
    const url = normalizeAnime4upUrl(rawUrl);
    if (!url || !/\/episode\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    const fields = episodeLabelFields(label, url);
    episodes.push({
      url,
      name: fields.name,
      number: fields.number,
      date: "",
      locked: false,
    });
  };

  for (const match of html.matchAll(/<div[^>]*class="[^"]*ep_num[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    add(match[1], match[2]);
  }
  for (const match of html.matchAll(/<ul[^>]*class="[^"]*all-episodes-list[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi)) {
    for (const link of match[1].matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      add(link[1], link[2]);
    }
  }
  for (const match of html.matchAll(/<a[^>]*class="[^"]*overlay[^"]*"[^>]*href="([^"]*\/episode\/[^"?#]+)"[^>]*>/gi)) {
    add(match[1]);
  }
  return episodes.sort((a, b) => episodeSortKey(b.number) - episodeSortKey(a.number));
}

export function parseAnime4upFilterLinks(html) {
  const categories = [];
  const tags = [];
  const seen = { category: new Set(), tag: new Set() };
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    if (!href) continue;
    let target;
    try { target = new URL(href, DEFAULT_BASE_URL); } catch { continue; }
    if (!isAllowedAnime4upHost(target.hostname)) continue;
    const parts = target.pathname.split("/").filter(Boolean);
    const genreIndex = parts.indexOf("anime-genre");
    const typeIndex = parts.indexOf("anime-type");
    const categoryIndex = parts.indexOf("anime-category");
    const seasonIndex = parts.indexOf("anime-season");
    let type = "";
    let slug = "";
    if (genreIndex >= 0) {
      type = "category";
      slug = decodeURIComponent(parts[genreIndex + 1] || "");
    } else if (typeIndex >= 0) {
      type = "tag";
      slug = decodeURIComponent(parts[typeIndex + 1] || "");
    } else if (categoryIndex >= 0) {
      type = "category";
      slug = decodeURIComponent(parts[categoryIndex + 1] || "");
    } else if (seasonIndex >= 0) {
      type = "tag";
      slug = decodeURIComponent(parts[seasonIndex + 1] || "");
    }
    if (!type || !slug) continue;
    const name = textOnly(match[2]).replace(/^#/, "").trim();
    const key = `${type}:${slug}:${name.toLocaleLowerCase("ar")}`;
    if (!name || name.length > 60 || seen[type].has(key)) continue;
    seen[type].add(key);
    const entry = { slug, name, count: 0, filterPath: target.pathname.endsWith("/") ? target.pathname : `${target.pathname}/` };
    (type === "category" ? categories : tags).push(entry);
  }
  return { categories, tags };
}

function parseAnimeInfoValue(html, label) {
  const block = html.match(new RegExp(`<div class="anime-info"><span>${label}:<\\/span>\\s*([\\s\S]*?)<\\/div>`, "i"))?.[1] ?? "";
  const linked = block.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1];
  return textOnly(linked || block);
}

export function parseAnime4upDetails(html, url, chapters = []) {
  const slug = slugFromAnimeUrl(url);
  const title = textOnly(html.match(/<h1[^>]*class="[^"]*anime-details-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1] ?? "");
  const cover = parseAnime4upCover(html);
  const summary = textOnly(html.match(/<p[^>]*class="[^"]*anime-story[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const typeLabel = parseAnimeInfoValue(html, "نوع الأنمي") || textOnly(html.match(/<div[^>]*class="[^"]*anime-info[^"]*"[^>]*>[\s\S]*?نوع الأنمي:[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
  const media = resolveMediaType(typeLabel);
  const totalEpisodes = Number(parseAnimeInfoValue(html, "عدد الحلقات")) || 0;
  const year = parseAnimeInfoValue(html, "بداية العرض");
  const episodeDuration = parseAnimeInfoValue(html, "مدة الحلقة");
  const season = parseAnimeInfoValue(html, "الموسم");
  const categories = [];
  const tags = [];
  const genresBlock = html.match(/<ul[^>]*class="[^"]*anime-genres[^"]*"[^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? "";
  for (const match of genresBlock.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = textOnly(match[1]);
    if (label) categories.push(label);
  }
  if (season) tags.push(season);
  for (const match of html.matchAll(/<div[^>]*class="[^"]*anime-info[^"]*"[^>]*>[\s\S]*?<a[^>]*href="[^"]*\/anime-season\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = textOnly(match[1]);
    if (label && !tags.includes(label)) tags.push(label);
  }
  const sorted = [...chapters].sort((a, b) => episodeSortKey(b.number) - episodeSortKey(a.number));
  const latest = sorted[0];
  const altParts = [season, year, episodeDuration].filter(Boolean);
  return enrichSourceDetails({
    id: slug,
    title,
    altTitle: altParts.join(" · "),
    cover,
    summary,
    url,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    ...media,
    categories: categories.slice(0, 30),
    tags: tags.slice(0, 20),
    totalEpisodes: totalEpisodes || sorted.length,
    year,
    episodeDuration,
    status: parseAnimeInfoValue(html, "حالة الأنمي") || parseAnimeInfoValue(html, "الحالة"),
    chapters: sorted,
    latestChapter: latest?.number ?? "—",
    latestChapterUrl: latest?.url ?? null,
    recentChapters: sorted.slice(0, 2),
  });
}

export function extractVnxStreamUrl(html = "") {
  const match = String(html).match(/streamUrl\s*=\s*["'](https?:[^"']+)["']/i);
  if (match) {
    const decoded = decodeHtml(match[1].replace(/\\u0026/g, "&"));
    if (decoded && !isAdSegmentUrl(decoded)) return decoded;
  }
  const plain = String(html).match(/https?:\/\/[^"'\\\s]+\.m3u8[^"'\\\s]*/i)?.[0] || "";
  const decoded = decodeHtml(plain);
  return decoded && !isAdSegmentUrl(decoded) ? decoded : "";
}

export function extractVnxSubtitleTracks(html = "") {
  const match = String(html).match(/tracks\s*=\s*(\[[\s\S]*?\])\s*;/i);
  if (!match) return [];
  try {
    const tracks = JSON.parse(match[1]);
    if (!Array.isArray(tracks)) return [];
    return tracks.map((track, index) => {
      const candidates = [track.file, ...(Array.isArray(track.fallbacks) ? track.fallbacks : [])];
      const file = candidates
        .map((entry) => normalizeAnime4upUrl(entry, { keepHost: true }))
        .find((entry) => entry && /\.(?:vtt|srt)(?:\?|$)/i.test(entry));
      if (!file) return null;
      return {
        url: file,
        label: textOnly(track.label) || "ترجمة",
        lang: String(track.srclang || "ar").slice(0, 12),
        kind: track.kind === "captions" ? "captions" : "subtitles",
        default: Boolean(track.default) || index === 0,
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function enrichSourcesWithStreams(sources = [], fetchHtml) {
  return Promise.all(sources.map(async (source) => {
    if (!isAnime4upNativePlayerUrl(source.url)) {
      return source;
    }
    try {
      const playerHtml = await fetchHtml(source.url);
      const streamUrl = extractVnxStreamUrl(playerHtml);
      const subtitleTracks = extractVnxSubtitleTracks(playerHtml);
      return {
        ...source,
        streamUrl: streamUrl || "",
        streamReferer: source.url,
        subtitleTracks,
      };
    } catch {
      return source;
    }
  }));
}

export async function enrichAnime4upEpisodePlayback(html, episodeUrl, fetchHtml) {
  const episode = parseAnime4upEpisode(html, episodeUrl);
  const sources = await enrichSourcesWithStreams(episode.sources, fetchHtml);
  const hlsSources = sources.filter((entry) => entry.streamUrl);
  const playable = hlsSources[0];
  if (playable) {
    return {
      ...episode,
      sources,
      videoUrl: playable.streamUrl,
      streamUrl: playable.streamUrl,
      streamReferer: playable.streamReferer || episodeUrl,
      subtitleTracks: playable.subtitleTracks || [],
      playbackMode: "hls",
      activeSource: playable.label,
      embedUrl: "",
    };
  }

  const externalEmbed = pickAnime4upExternalEmbedUrl(sources);
  return {
    ...episode,
    sources,
    embedUrl: externalEmbed,
    playbackMode: externalEmbed ? "embed" : undefined,
    streamUrl: "",
    videoUrl: "",
  };
}

export function parseAnime4upEpisode(html, url) {
  const title = textOnly(
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.split("|")[0]
      ?? "حلقة",
  );
  const sources = [];
  const seen = new Set();
  for (const match of html.matchAll(/<li[^>]*data-watch="([^"]+)"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi)) {
    const embedUrl = normalizeAnime4upEmbedUrl(match[1]);
    if (!embedUrl || seen.has(embedUrl)) continue;
    seen.add(embedUrl);
    const label = textOnly(match[2].replace(/<span[^>]*class="[^"]*quality[^"]*"[\s\S]*?<\/span>/gi, ""));
    sources.push({ label: label || "سيرفر", url: embedUrl });
  }
  if (!sources.length) {
    for (const match of html.matchAll(/<iframe[^>]*src="([^"]+)"[^>]*title="مشغل الحلقة"/gi)) {
      const embedUrl = normalizeAnime4upEmbedUrl(match[1]);
      if (!embedUrl || seen.has(embedUrl) || embedUrl.includes("newServerUrl")) continue;
      seen.add(embedUrl);
      sources.push({ label: "مشغل", url: embedUrl });
    }
  }
  const rankedSources = sortAnime4upSources(sources);
  const embedUrl = pickAnime4upEmbedUrl(rankedSources, url);
  if (!embedUrl) throw new Error("تعذر استخراج مشغل الحلقة");
  return {
    title,
    url,
    kind: "video",
    embedUrl,
    playerUrl: url,
    sources: rankedSources,
  };
}

const KIND_FILTER_PATHS = new Set([
  "/all",
  "/all/",
  "/anime-type/tv2",
  "/anime-type/tv2/",
  "/anime-type/movie",
  "/anime-type/movie/",
]);

export function isAnime4upCatalogScopedSearchPath(filterPath = "") {
  const raw = String(filterPath || "").trim();
  if (!raw || !/^\/[\p{L}\p{N}/+_.%-]+\/?$/u.test(raw) || raw.includes("..")) return false;
  return !KIND_FILTER_PATHS.has(raw);
}

function buildCatalogUrl(page, filterPath = CATALOG_PATH) {
  const normalized = filterPath.startsWith("/") ? filterPath : `/${filterPath}`;
  if (normalized.replace(/\/$/, "") === HOME_PATH.replace(/\/$/, "")) {
    return page <= 1 ? `${DEFAULT_BASE_URL}${HOME_PATH}` : `${DEFAULT_BASE_URL}${HOME_PATH}?wa_latest_episodes_ajax=1&wa_latest_page=${page}`;
  }
  if (page <= 1) return `${DEFAULT_BASE_URL}${normalized}`;
  const trimmed = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  return `${DEFAULT_BASE_URL}${trimmed}/page/${page}/`;
}

function catalogHasMore(html, page, filterPath = CATALOG_PATH) {
  const normalized = (filterPath.startsWith("/") ? filterPath : `/${filterPath}`).replace(/\/$/, "");
  if (normalized === HOME_PATH.replace(/\/$/, "")) {
    return /data-next-page="(\d+)"/i.test(html) || /"has_more"\s*:\s*true/i.test(html);
  }
  return new RegExp(`${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/page/${page + 1}`, "i").test(html);
}

async function fetchLatestEpisodesPage(page, baseUrl = DEFAULT_BASE_URL, fetchHtml) {
  if (page <= 1) {
    const html = await fetchHtml(`${baseUrl}${HOME_PATH}`);
    return {
      html: catalogHtmlForHome(html, page),
      hasMore: catalogHasMore(html, page, HOME_PATH),
    };
  }
  const response = await publicFetch(`${baseUrl}${HOME_PATH}?wa_latest_episodes_ajax=1&wa_latest_page=${page}`, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      referer: `${baseUrl}${HOME_PATH}`,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "x-requested-with": "XMLHttpRequest",
    },
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) throw new Error(`Anime4up a répondu ${response.status}`);
  const json = await response.json();
  if (!json?.success || !json.data?.html) return { html: "", hasMore: false };
  return { html: canonicalAnime4upHtml(json.data.html), hasMore: Boolean(json.data.has_more) };
}

function catalogHtmlForHome(html, page) {
  const normalized = canonicalAnime4upHtml(html);
  if (page <= 1) {
    const latestGrid = extractLatestEpisodesHtml(normalized);
    if (latestGrid) return latestGrid;
  }
  return normalized;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function fetchAnime4upEpisodes(animeUrl, html, fetchHtml, ctx = DEFAULT_CTX) {
  const cacheKey = assertAnimeUrl(animeUrl, ctx);
  const cached = anime4upSeriesEpisodesCache.get(cacheKey);
  if (cached?.complete && Date.now() - cached.at < ANIME4UP_SERIES_EPISODES_CACHE_TTL_MS) {
    return cached.chapters;
  }

  let chapters = parseAnime4upEpisodes(html);
  const maxPages = Math.min(Number(html.match(/data-max-pages="(\d+)"/i)?.[1] ?? 0), 40);
  if (maxPages > 1) {
    const base = cacheKey.replace(/\/$/, "");
    const pageUrls = Array.from({ length: maxPages - 1 }, (_, index) => `${base}/page/${index + 2}/`);
    const pages = await mapWithConcurrency(pageUrls, 4, async (url) => {
      try {
        return await fetchHtml(url);
      } catch {
        return "";
      }
    });
    const seen = new Set(chapters.map((entry) => entry.url));
    for (const pageHtml of pages) {
      for (const episode of parseAnime4upEpisodes(pageHtml || "")) {
        if (seen.has(episode.url)) continue;
        seen.add(episode.url);
        chapters.push(episode);
      }
    }
  }
  chapters = chapters.sort((a, b) => episodeSortKey(b.number) - episodeSortKey(a.number));
  anime4upSeriesEpisodesCache.set(cacheKey, { at: Date.now(), chapters, complete: true });
  return chapters;
}

function appendUniqueCatalogItems(pool, seen, items = []) {
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    pool.push(item);
  }
}

function isHomeCatalogPath(filterPath = "") {
  return filterPath.replace(/\/$/, "") === HOME_PATH.replace(/\/$/, "");
}

async function fetchHomeCatalogUpstream(upstreamPage, fetchHtml, ctx) {
  if (upstreamPage <= 1) {
    const homeHtml = canonicalAnime4upHtml(await fetchHtml(`${ctx.baseUrl}${HOME_PATH}`), ctx.baseUrl);
    const gridHtml = catalogHtmlForHome(homeHtml, 1);
    return {
      html: gridHtml,
      items: parseAnime4upCatalog(gridHtml),
      hasMore: catalogHasMore(homeHtml, 1, HOME_PATH),
    };
  }
  const result = await fetchLatestEpisodesPage(upstreamPage, ctx.baseUrl, fetchHtml);
  const html = canonicalAnime4upHtml(result.html, ctx.baseUrl);
  return {
    html,
    items: parseAnime4upCatalog(html),
    hasMore: result.hasMore,
  };
}

async function fetchListCatalogUpstream(upstreamPage, filterPath, fetchHtml, ctx) {
  const html = canonicalAnime4upHtml(
    await fetchHtml(buildCatalogUrl(upstreamPage, filterPath)),
    ctx.baseUrl,
  );
  return {
    html,
    items: parseAnime4upCatalog(html),
    hasMore: catalogHasMore(html, upstreamPage, filterPath),
  };
}

async function enrichAnime4upCatalog(items, fetchHtml) {
  return enrichCatalogItems(items, {
    concurrency: 6,
    needsEnrich: (item) => item.mediaType !== "movie" && catalogNeedsRecentEnrich(item, 1),
    enrichItem: async (item) => {
      const cached = anime4upSeriesEpisodesCache.get(item.url);
      if (cached && Date.now() - cached.at < ANIME4UP_SERIES_EPISODES_CACHE_TTL_MS) {
        return cached.chapters;
      }
      const html = await fetchHtml(item.url);
      const chapters = recentChaptersFromList(parseAnime4upEpisodes(html));
      anime4upSeriesEpisodesCache.set(item.url, { at: Date.now(), chapters, complete: false });
      return chapters;
    },
  });
}

async function collectCatalogPool(fetchUpstream, { offset, pageSize, maxUpstreamPages }) {
  const seen = new Set();
  const pool = [];
  const needed = offset + pageSize;
  const first = await fetchUpstream(1).catch(() => ({ items: [], hasMore: false }));
  appendUniqueCatalogItems(pool, seen, first.items);
  if (!first.items?.length) {
    return { pool, hasMoreUpstream: false };
  }
  let hasMoreUpstream = Boolean(first.hasMore);
  let upstreamPage = 2;

  while (pool.length < needed && hasMoreUpstream && upstreamPage <= maxUpstreamPages) {
    const batchSize = Math.min(2, maxUpstreamPages - upstreamPage + 1);
    const pages = await Promise.all(
      Array.from({ length: batchSize }, (_, index) => (
        fetchUpstream(upstreamPage + index).catch(() => ({ items: [], hasMore: false }))
      )),
    );
    let grew = false;
    for (const upstream of pages) {
      const before = pool.length;
      appendUniqueCatalogItems(pool, seen, upstream.items);
      if (pool.length > before) grew = true;
      hasMoreUpstream = Boolean(upstream.hasMore);
    }
    upstreamPage += batchSize;
    if (!grew) break;
  }

  return { pool, hasMoreUpstream };
}

export async function fetchAnime4upCatalogPage(ctx, fetchHtml, { page = 1, filterPath = HOME_PATH } = {}) {
  const normalized = filterPath?.trim() || HOME_PATH;
  const isHome = isHomeCatalogPath(normalized);
  const offset = (page - 1) * ANIME4UP_CATALOG_PAGE_SIZE;
  const fetchUpstream = isHome
    ? (upstream) => fetchHomeCatalogUpstream(upstream, fetchHtml, ctx)
    : (upstream) => fetchListCatalogUpstream(upstream, normalized, fetchHtml, ctx);

  const { pool, hasMoreUpstream } = await collectCatalogPool(fetchUpstream, {
    offset,
    pageSize: ANIME4UP_CATALOG_PAGE_SIZE,
    maxUpstreamPages: page + 6,
  });

  const items = pool.slice(offset, offset + ANIME4UP_CATALOG_PAGE_SIZE);
  await enrichAnime4upCatalog(items, fetchHtml);

  return {
    items,
    page,
    filterPath: normalized,
    hasMore: items.length === ANIME4UP_CATALOG_PAGE_SIZE && (pool.length > offset + items.length || hasMoreUpstream),
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchAnime4upFilters(fetchHtml, baseUrl) {
  const cacheKey = baseUrl;
  const cached = anime4upFiltersCache.get(cacheKey);
  if (cached && Date.now() - cached.at < ANIME4UP_FILTERS_CACHE_TTL_MS) return cached.data;
  const html = await fetchHtml(`${baseUrl}${CATALOG_PATH}`);
  const data = mergeFilterGroups([parseAnime4upFilterLinks(html)]);
  anime4upFiltersCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

export async function handleAnime4upRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: SOURCE_NAME });
  const fetchAnime4upHtml = createAnime4upFetcher(ctx.baseUrl);

  if (requestUrl.pathname.endsWith("/image")) {
    return fetchAnime4upProxiedImage(requestUrl.searchParams.get("url") ?? "");
  }

  if (requestUrl.pathname.endsWith("/stream")) {
    const target = assertAnime4upStreamUrl(requestUrl.searchParams.get("url") ?? "");
    const referer = assertAnime4upStreamReferer(requestUrl.searchParams.get("referer") ?? "");
    return await fetchProxiedHlsResource({
      target,
      referer,
      label: SOURCE_NAME,
      buildProxyUrl: (entry) => buildAnime4upStreamProxyPath(entry, referer),
    });
  }

  if (requestUrl.pathname.endsWith("/subtitle")) {
    const target = assertAnime4upSubtitleUrl(requestUrl.searchParams.get("url") ?? "");
    const referer = assertAnime4upStreamReferer(requestUrl.searchParams.get("referer") ?? `${ctx.baseUrl}/`);
    return await fetchProxiedSubtitle(target, referer);
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const filters = await fetchAnime4upFilters(fetchAnime4upHtml, ctx.baseUrl);
    return responseJson(200, { ...filters, fetchedAt: new Date().toISOString() });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const filterPath = requestUrl.searchParams.get("filterPath")?.trim() || HOME_PATH;
    if (!/^\/[\p{L}\p{N}/+_.%-]+\/?$/u.test(filterPath) || filterPath.includes("..")) {
      throw new Error("مسار فلتر Anime4up غير صالح");
    }
    const payload = await fetchAnime4upCatalogPage(ctx, fetchAnime4upHtml, { page, filterPath });
    return responseJson(200, payload);
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const filterPath = requestUrl.searchParams.get("filterPath")?.trim() || "";
    if (isAnime4upCatalogScopedSearchPath(filterPath)) {
      const payload = await fetchAnime4upCatalogPage(ctx, fetchAnime4upHtml, { page, filterPath });
      const items = payload.items.filter((item) => (
        `${item.title} ${item.altTitle || ""}`.toLocaleLowerCase("ar").includes(query.toLocaleLowerCase("ar"))
      ));
      return responseJson(200, {
        items,
        page,
        hasMore: payload.hasMore,
        fetchedAt: payload.fetchedAt,
      });
    }
    const html = await fetchAnime4upHtml(`${ctx.baseUrl}/?s=${encodeURIComponent(query)}`);
    let items = parseAnime4upCatalog(canonicalAnime4upHtml(html, ctx.baseUrl));
    items = items.slice(0, ANIME4UP_CATALOG_PAGE_SIZE);
    await enrichAnime4upCatalog(items, fetchAnime4upHtml);
    return responseJson(200, { items, page: 1, hasMore: false });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertAnimeUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    const html = await fetchAnime4upHtml(target);
    const chapters = await fetchAnime4upEpisodes(target, html, fetchAnime4upHtml, ctx);
    return responseJson(200, parseAnime4upDetails(html, target, chapters));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertEpisodeUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    const html = await fetchAnime4upHtml(target);
    return responseJson(200, await enrichAnime4upEpisodePlayback(html, target, fetchAnime4upHtml));
  }

  return responseJson(404, { error: "Route Anime4up inconnue" });
}
