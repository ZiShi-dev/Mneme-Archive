import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage, fetchWithRetries } from "../lib/httpUtils.js";
import { fetchProxiedHlsResource, isAdSegmentUrl } from "../lib/hlsProxy.js";
import {
  assertProxiedStreamUrl,
  decodePackedPlayerSource,
  enrichSourcesWithStreams,
  extractPackedPlayerStreamUrl,
  resolveEmbedDirectStream,
} from "../lib/embedResolvers.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields } from "../lib/catalogChapters.js";
import { sortSourcesByVideoHost } from "../lib/videoHosts.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";

const DEFAULT_BASE_URL = "https://french-stream.one";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
const SOURCE_NAME = "French Stream";
const SOURCE_ID = "frenchstream";
const CATALOG_PATH = "/films/";
const SERIES_PATH = "/s-tv/";
const MIXED_PATH = "/all/";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const IMAGE_HOSTS = new Set([
  DEFAULT_CTX.apex,
  DEFAULT_CTX.hostname,
  `www.${DEFAULT_CTX.apex}`,
  "image.tmdb.org",
  "i.imgur.com",
  "imgur.com",
]);

const STREAM_HOST_PATTERN = /(?:^|\.)(?:vidzy\.(?:cc|live|org)|fsvid\.lol|uqload\.|filemoon\.)/i;
const DIRECT_PLAYER_PATTERN = /(?:vidzy\.(?:cc|live|org)|fsvid\.lol|uqload\.|filemoon\.)/i;
const FAKE_STREAM_PATTERN = /(?:troll\/master|\/ads?\/|preroll|fake\.m3u8|decoy)/i;
const PACKED_PLAYER_PATTERN = /\)\("([A-Za-z0-9+/=]{40,})"\)/g;

const PLAYER_HOST_ORDER = [
  /vidzy\./i,
  /fsvid\./i,
  /uqload\./i,
  /voe/i,
  /dood/i,
  /kakaflix/i,
];
const PLAYER_LABELS = {
  premium: "Premium",
  vidzy: "Vidzy",
  uqload: "Uqload",
  dood: "Dood",
  netu: "Netu",
  voe: "VOE",
  filmoon: "Filmoon",
};

const LANG_LABELS = {
  default: "VF",
  vostfr: "VOSTFR",
  vfq: "VFQ",
  vff: "VFF",
  vo: "VO",
};

function createFrenchStreamFetcher(baseUrl = DEFAULT_BASE_URL) {
  return createCachedHtmlFetcher({
    ttlMs: 3 * 60_000,
    timeoutMs: 40_000,
    retries: 2,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.6",
      referer: `${baseUrl}/`,
      "user-agent": BROWSER_UA,
    },
    getVariants: (url) => [url],
    buildError: (lastStatus) => `French Stream a répondu ${lastStatus || "sans réponse"}`,
  });
}

function isAllowedHost(hostname = "", ctx = DEFAULT_CTX) {
  return ctx.allowedHosts.has(String(hostname).toLowerCase());
}

function buildFrenchStreamStreamProxyPath(targetUrl, referer = "") {
  const params = new URLSearchParams({ url: targetUrl });
  if (referer) params.set("referer", referer);
  return `/api/sources/${SOURCE_ID}/stream?${params}`;
}

export { decodePackedPlayerSource, extractPackedPlayerStreamUrl } from "../lib/embedResolvers.js";

export function assertFrenchStreamStreamUrl(rawUrl = "") {
  return assertProxiedStreamUrl(rawUrl);
}

export function assertFrenchStreamStreamReferer(rawUrl = "") {
  const decoded = decodeHtml(rawUrl);
  if (!decoded) throw new Error("مرجع البث غير صالح");
  const url = new URL(decoded);
  if (url.protocol !== "https:") throw new Error("مرجع البث غير صالح");
  url.hash = "";
  return url.toString();
}

export async function resolveFrenchStreamDirectStream(embedUrl = "") {
  return resolveEmbedDirectStream(embedUrl);
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

function assertFrenchStreamHost(rawUrl) {
  const normalized = normalizeFrenchStreamUrl(rawUrl);
  if (!normalized) throw new Error("المصدر غير مسموح");
  return new URL(normalized);
}

export function newsIdFromUrl(rawUrl = "") {
  const url = new URL(normalizeFrenchStreamUrl(rawUrl) || "https://invalid.local/");
  const fromQuery = url.searchParams.get("newsid");
  if (/^\d+$/.test(fromQuery || "")) return fromQuery;
  const pretty = url.pathname.match(/^\/(\d+)-[^/]+\.html$/i);
  return pretty ? pretty[1] : "";
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

function episodeUrl(seasonUrl, number) {
  return `${assertMovieUrl(seasonUrl)}&ep=${Number(number)}`;
}

export function assertFrenchStreamImageUrl(rawUrl) {
  const decoded = decodeHtml(rawUrl);
  let url;
  try {
    url = new URL(decoded);
  } catch {
    throw new Error("رابط الصورة غير مسموح");
  }
  if (url.protocol !== "https:" || !IMAGE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("رابط الصورة غير مسموح");
  }
  return url.toString();
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

function watchEntry(url, label = "1") {
  return {
    url,
    name: String(label || "1"),
    number: String(label || "1"),
    date: "",
    locked: false,
  };
}

function isSeriesCard(block = "") {
  return /mli-eps|version-serie|s-tv|saison/i.test(block);
}

function parseEpisodeProgress(block = "") {
  const text = textOnly(block.match(/<span class="mli-eps">([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const match = text.match(/ep\s*(\d+)\s*(?:sur|\/)\s*(\d+)/i);
  if (!match) return { latest: 0, total: 0 };
  return { latest: Number(match[1]), total: Number(match[2]) };
}

function isSeriesSearchHit(url = "", title = "", block = "") {
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

function parseCardVersion(block = "") {
  return textOnly(block.match(/<span class="film-version">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
}

export function parseFrenchStreamCatalog(html = "") {
  const results = [];
  const seen = new Set();
  const starts = [...html.matchAll(/<div class="short">/gi)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const href = block.match(/<a[^>]*class="[^"]*short-poster[^"]*"[^>]*href="([^"]+)"/i)?.[1]
      || block.match(/href="(\/index\.php\?newsid=\d+)"/i)?.[1]
      || "";
    const url = normalizeFrenchStreamUrl(href);
    const newsId = newsIdFromUrl(url);
    if (!url || !newsId || seen.has(newsId)) return;
    const title = textOnly(
      block.match(/<div class="short-title">([\s\S]*?)<\/div>/i)?.[1]
        || block.match(/alt="([^"]+)"/i)?.[1]
        || "",
    ).replace(/\s+affiche\s*$/i, "").trim();
    if (!title) return;
    seen.add(newsId);
    const cover = decodeHtml(block.match(/<img[^>]*src="([^"]+)"/i)?.[1] ?? "");
    const summary = textOnly(block.match(/<span id="desc-\d+"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const quality = textOnly(block.match(/<span class="film-quality">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
    const version = parseCardVersion(block);
    const audioLabel = normalizeFrenchStreamAudioLabel(version);
    const series = isSeriesCard(block);
    const episodeProgress = series ? parseEpisodeProgress(block) : { latest: 0 };
    const chapters = series
      ? seriesCatalogChapters(url, episodeProgress.latest)
      : [watchEntry(url, quality || version || "1")];
    results.push(applyRecentChapterFields({
      id: newsId,
      title,
      altTitle: series
        ? [audioLabel || version, episodeProgress.latest ? `Ep ${episodeProgress.latest}` : ""].filter(Boolean).join(" · ")
        : [audioLabel || version, quality].filter(Boolean).join(" · "),
      url,
      cover,
      summary,
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType: series ? "series" : "movie",
      mediaTypeLabel: series ? "مسلسل" : "فيلم",
      audioLabel,
    }, chapters));
  });
  return results;
}

function seriesCatalogChapters(seasonUrl, latestEpisode) {
  const latest = Number(latestEpisode) > 0 ? Number(latestEpisode) : 1;
  const chapters = [watchEntry(episodeUrl(seasonUrl, latest), String(latest))];
  if (latest > 1) chapters.push(watchEntry(episodeUrl(seasonUrl, latest - 1), String(latest - 1)));
  return chapters;
}

export function parseFrenchStreamSearch(html = "") {
  const results = [];
  const seen = new Set();
  for (const match of html.matchAll(/<div class=['"]search-item['"][^>]*onclick="location\.href='([^']+)'"[\s\S]*?<\/div>\s*<\/div>/gi)) {
    const url = normalizeFrenchStreamUrl(match[1]);
    const newsId = newsIdFromUrl(url);
    const block = match[0];
    if (!url || !newsId || seen.has(newsId)) continue;
    const title = textOnly(block.match(/<div class=['"]search-title['"]>([\s\S]*?)<\/div>/i)?.[1] ?? "");
    if (!title) continue;
    seen.add(newsId);
    const cover = decodeHtml(block.match(/<img[^>]*src=['"]([^'"]+)['"]/i)?.[1] ?? "");
    const year = title.match(/\((\d{4})\)\s*$/)?.[1] || "";
    const cleanTitle = title.replace(/\s*\(\d{4}\)\s*$/, "").trim() || title;
    const series = isSeriesSearchHit(url, cleanTitle, block);
    const audioLabel = normalizeFrenchStreamAudioLabel(`${cleanTitle} ${url}`);
    results.push(applyRecentChapterFields({
      id: newsId,
      title: cleanTitle,
      altTitle: year,
      url,
      cover,
      summary: "",
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType: series ? "series" : "movie",
      mediaTypeLabel: series ? "مسلسل" : "فيلم",
      audioLabel,
    }, [watchEntry(series ? episodeUrl(url, 1) : url, "1")]));
  }
  return results;
}

export function parseFrenchStreamFilters(html = "", { includeSeriesGenres = false } = {}) {
  const categories = [];
  const tags = [];
  const seen = { category: new Set(), tag: new Set() };
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    if (!href) continue;
    let target;
    try { target = new URL(href, DEFAULT_BASE_URL); } catch { continue; }
    if (!isAllowedHost(target.hostname)) continue;
    const path = `${target.pathname}${target.pathname.endsWith("/") ? "" : "/"}`;
    const name = textOnly(match[2]).replace(/^#/, "").trim();
    if (!name || name.length > 40) continue;
    const genre = path.match(/^\/films\/([a-z0-9-]+)\/$/i)?.[1];
    if (genre && genre !== "vf") {
      if (includeSeriesGenres) continue;
      const key = `category:${genre}`;
      if (seen.category.has(key)) continue;
      seen.category.add(key);
      categories.push({
        slug: genre,
        name,
        count: 0,
        filterPath: `/films/${genre}/`,
        mediaKind: "movies",
      });
      continue;
    }
    const seriesGenre = path.match(/^\/([a-z0-9-]*series?[a-z0-9-]*|streaming-tv-realits)\/$/i)?.[1];
    if (seriesGenre && seriesGenre !== "s-tv") {
      if (!includeSeriesGenres) continue;
      const key = `category:series:${seriesGenre}`;
      if (seen.category.has(key)) continue;
      seen.category.add(key);
      categories.push({
        slug: seriesGenre,
        name,
        count: 0,
        filterPath: `/${seriesGenre}/`,
        mediaKind: "series",
      });
      continue;
    }
    const year = path.match(/^\/xfsearch\/date-de-sortie\/(\d{4})\/$/i)?.[1];
    if (year) {
      const key = `tag:year:${year}`;
      if (seen.tag.has(key)) continue;
      seen.tag.add(key);
      tags.push({ slug: year, name: year, count: 0, filterPath: `/xfsearch/date-de-sortie/${year}/` });
    }
  }
  return { categories, tags };
}

const SEQUEL_SUFFIX_PATTERN = /\s*(?:[:\-–—]\s*)?(?:chapitre|chapter|part(?:ie)?)\s+\d+\b.*$/i;
const TRAILING_SEQUEL_PATTERN = /\s+(?:\d+|II|III|IV|V|VI|VII|VIII|IX|X)\s*$/i;

export function relatedSearchQuery(title = "") {
  let query = String(title || "").replace(/\s*\(\d{4}\)\s*$/, "").trim();
  query = query.replace(/\s*[-–—]?\s*saison\s+\d+\b.*$/i, "").trim();
  const colonParts = query.split(/\s*:\s*/);
  if (colonParts.length >= 2) {
    const beforeColon = colonParts[0].trim();
    const afterColon = colonParts.slice(1).join(" ").trim();
    const afterWords = afterColon.split(/\s+/).filter(Boolean);
    if (beforeColon.length >= 8 && beforeColon.split(/\s+/).length >= 2 && afterWords.length === 1) {
      query = beforeColon;
    }
  }
  return query.replace(SEQUEL_SUFFIX_PATTERN, "").replace(TRAILING_SEQUEL_PATTERN, "").trim();
}

function normalizeTitleKey(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isRelatedFrenchStreamTitle(currentTitle, candidateTitle, query) {
  const current = normalizeTitleKey(currentTitle);
  const candidate = normalizeTitleKey(candidateTitle);
  const needle = normalizeTitleKey(query);
  if (!candidate || candidate === current) return false;
  if (needle && (candidate === needle || candidate.startsWith(`${needle} `))) return true;
  const currentWords = current.split(" ").filter(Boolean);
  const candidateWords = candidate.split(" ").filter(Boolean);
  return currentWords.length >= 2
    && candidateWords.length >= 2
    && currentWords[0] === candidateWords[0]
    && currentWords[1] === candidateWords[1];
}

export function pickRelatedFrenchStreamMovies(items = [], { currentId, currentTitle, query, limit = 12 } = {}) {
  const seen = new Set([String(currentId || "")]);
  const related = [];
  for (const item of items) {
    if (!item?.id || seen.has(String(item.id))) continue;
    if (!isRelatedFrenchStreamTitle(currentTitle, item.title, query)) continue;
    seen.add(String(item.id));
    related.push(item);
  }
  return related
    .sort((left, right) => Number(left.year || left.altTitle || 0) - Number(right.year || right.altTitle || 0))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      title: item.title,
      altTitle: item.altTitle || item.year || "",
      url: item.url,
      cover: item.cover,
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType: item.mediaType || "movie",
      mediaTypeLabel: item.mediaTypeLabel || (item.mediaType === "series" ? "مسلسل" : "فيلم"),
      year: item.year || (/^\d{4}$/.test(String(item.altTitle || "")) ? item.altTitle : ""),
    }));
}

async function fetchRelatedMovies(title, currentId) {
  const query = relatedSearchQuery(title);
  if (query.length < 3) return [];
  try {
    const html = await fetchSearchHtml(query);
    return pickRelatedFrenchStreamMovies(parseFrenchStreamSearch(html), {
      currentId,
      currentTitle: title,
      query,
    });
  } catch {
    return [];
  }
}

function catalogHasMore(html, page) {
  return new RegExp(`cstart=${page + 1}\\b|/page/${page + 1}/`, "i").test(html);
}

function buildCatalogUrl(page, filterPath = CATALOG_PATH) {
  const path = assertFilterPath(filterPath);
  if (page <= 1) return `${DEFAULT_BASE_URL}${path}`;
  if (path.startsWith("/xfsearch/")) {
    const trimmed = path.endsWith("/") ? path : `${path}/`;
    return `${DEFAULT_BASE_URL}${trimmed}page/${page}/`;
  }
  const category = path.replace(/^\/+|\/+$/g, "").split("/").pop() || "films";
  return `${DEFAULT_BASE_URL}/index.php?cstart=${page}&do=cat&category=${encodeURIComponent(category)}`;
}

export function parseFrenchStreamDetails(html, url) {
  if (/id=["']serie-data["']/i.test(html)) return parseFrenchStreamSeriesDetails(html, url);
  return parseFrenchStreamMovieDetails(html, url);
}

function parseFrenchStreamGenres(html = "") {
  const genresBlock = html.match(/<span class="genres">([\s\S]*?)<\/span>/i)?.[1] ?? "";
  const fromLinks = [];
  for (const match of genresBlock.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = textOnly(match[1]);
    if (label && !fromLinks.includes(label)) fromLinks.push(label);
  }
  if (fromLinks.length) return fromLinks;
  return textOnly(genresBlock).split(/[,،]/).map((entry) => entry.trim()).filter(Boolean);
}

function parseFrenchStreamYear(html = "") {
  return textOnly(html.match(/xfname=date-de-sortie[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "")
    || (html.match(/date-de-sortie\/(\d{4})/i)?.[1] ?? "");
}

function parseSerieTag(html = "") {
  const fromQuery = decodeHtml(html.match(/xfname=tagz[^"']*xf=([sS]-[a-z0-9_-]+)/i)?.[1] ?? "");
  if (fromQuery) return fromQuery;
  const fromText = textOnly(html.match(/class="sd-tagz"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
  return fromText.match(/s-[a-z0-9_-]+/i)?.[0] || "";
}

function parseDetailsAudio(html = "") {
  const version = textOnly(
    html.match(/id="film_lang"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
    ?? html.match(/xfname=version-(?:film|serie)[^>]*>([\s\S]*?)<\/a>/i)?.[1]
    ?? html.match(/<span class="film-version">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
    ?? "",
  );
  return { version, audioLabel: normalizeFrenchStreamAudioLabel(version) };
}

function parseFrenchStreamMovieDetails(html, url) {
  const canonical = assertMovieUrl(url);
  const newsId = newsIdFromUrl(canonical);
  const dataBlock = html.match(/<div id="film-data"([^>]*)>/i)?.[1] ?? "";
  const attr = (name) => decodeHtml(dataBlock.match(new RegExp(`data-${name}="([^"]*)"`, "i"))?.[1] ?? "");
  const title = textOnly(
    html.match(/<h1[^>]*id="s-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? attr("title")
      ?? html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.split("|")[0]
      ?? "",
  ).replace(/\s*-\s*\d{4}\s*$/, "").trim();
  const cover = attr("affiche") || decodeHtml(html.match(/<img[^>]*class="[^"]*dvd-thumbnail[^"]*"[^>]*src="([^"]+)"/i)?.[1] ?? "");
  const summary = textOnly(
    html.match(/<div class="fdesc[^"]*"[^>]*>[\s\S]*?<\/p>([\s\S]*?)<\/div>/i)?.[1]
      ?? "",
  );
  const year = parseFrenchStreamYear(html);
  const runtime = textOnly(html.match(/<span class="runtime">([\s\S]*?)<\/span>/i)?.[1] ?? "").replace(/^-\s*/, "");
  const { version, audioLabel } = parseDetailsAudio(html);
  const quality = textOnly(html.match(/id="film_quality"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
  const watch = watchEntry(canonical, quality || "1");
  return {
    id: newsId,
    title,
    altTitle: [year, runtime, audioLabel || version].filter(Boolean).join(" · "),
    cover,
    summary,
    url: canonical,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "movie",
    mediaTypeLabel: "فيلم",
    audioLabel,
    categories: parseFrenchStreamGenres(html).slice(0, 20),
    tags: [audioLabel || version, quality].filter(Boolean),
    totalEpisodes: 1,
    year,
    relatedItems: [],
    chapters: [watch],
    latestChapter: watch.number,
    latestChapterUrl: watch.url,
    recentChapters: [watch],
  };
}

function parseFrenchStreamSeriesDetails(html, url) {
  const canonical = assertMovieUrl(url);
  const newsId = newsIdFromUrl(canonical);
  const dataBlock = html.match(/<div id="serie-data"([^>]*)>/i)?.[1] ?? "";
  const attr = (name) => decodeHtml(dataBlock.match(new RegExp(`data-${name}="([^"]*)"`, "i"))?.[1] ?? "");
  const title = textOnly(
    html.match(/<h1[^>]*id="s-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? attr("title")
      ?? html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.split("|")[0]
      ?? "",
  ).replace(/\s*-\s*\d{4}\s*$/, "").trim();
  const cover = attr("affiche") || decodeHtml(html.match(/<img[^>]*class="[^"]*dvd-thumbnail[^"]*"[^>]*src="([^"]+)"/i)?.[1] ?? "");
  const summary = textOnly(html.match(/<div class="fdesc[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const year = parseFrenchStreamYear(html);
  const runtime = textOnly(html.match(/<span class="runtime">([\s\S]*?)<\/span>/i)?.[1] ?? "").replace(/^-\s*/, "");
  const { version, audioLabel } = parseDetailsAudio(html);
  return {
    id: newsId,
    title,
    altTitle: [year, runtime, audioLabel || version].filter(Boolean).join(" · "),
    cover,
    summary,
    url: canonical,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "series",
    mediaTypeLabel: "مسلسل",
    audioLabel,
    categories: parseFrenchStreamGenres(html).slice(0, 20),
    tags: [audioLabel].filter(Boolean),
    totalEpisodes: 0,
    year,
    serieTag: parseSerieTag(html),
    relatedItems: [],
    chapters: [],
    latestChapter: "—",
    latestChapterUrl: null,
    recentChapters: [],
  };
}

function hostMapHasUrl(hosts) {
  if (!hosts || typeof hosts !== "object") return false;
  return Object.values(hosts).some((value) => String(value || "").trim());
}

function episodeBucket(source, number) {
  if (!source || typeof source !== "object") return null;
  return source[String(number)] || source[number] || null;
}

export function frenchStreamAudioLanguagesFromEpisodeData(episodeData = {}) {
  const vf = episodeData?.vf || {};
  const vostfr = episodeData?.vostfr || {};
  const languages = [];
  const hasVf = Object.keys(vf).some((number) => hostMapHasUrl(episodeBucket(vf, number)));
  const hasVostfr = Object.keys(vostfr).some((number) => hostMapHasUrl(episodeBucket(vostfr, number)));
  if (hasVf) languages.push("VF");
  if (hasVostfr) languages.push("VOSTFR");
  return languages;
}

function frenchStreamAudioLabelFromLanguages(languages = [], fallback = "") {
  if (languages.includes("VF") && languages.includes("VOSTFR")) return "VF+VOSTFR";
  if (languages.length === 1) return languages[0];
  return fallback;
}

function attachFrenchStreamChapterAudioLanguages(chapter, audioLanguages = {}) {
  const entries = Object.entries(audioLanguages).filter(([, url]) => Boolean(url));
  if (!entries.length) return chapter;
  return {
    ...chapter,
    audioLanguages: Object.fromEntries(entries),
  };
}

export function parseFrenchStreamSeriesChapters(episodeData, seasonUrl) {
  const vf = episodeData?.vf || {};
  const vostfr = episodeData?.vostfr || {};
  const vo = episodeData?.vo || {};
  const info = episodeData?.info || {};
  const numbers = [...new Set([
    ...Object.keys(vf),
    ...Object.keys(vostfr),
    ...Object.keys(vo),
  ])]
    .map(Number)
    .filter((number) => Number.isFinite(number) && number > 0)
    .sort((left, right) => left - right);
  return numbers.flatMap((number) => {
    const playable = hostMapHasUrl(episodeBucket(vf, number))
      || hostMapHasUrl(episodeBucket(vostfr, number))
      || hostMapHasUrl(episodeBucket(vo, number));
    if (!playable) return [];
    const meta = episodeBucket(info, number) || {};
    const episodeTitle = String(meta.title || "").trim();
    const name = episodeTitle && !/^épisode\s+\d+$/i.test(episodeTitle)
      ? `${number} · ${episodeTitle}`
      : String(number);
    const watchUrl = episodeUrl(seasonUrl, number);
    const audioLanguages = {};
    if (hostMapHasUrl(episodeBucket(vf, number))) audioLanguages.VF = watchUrl;
    if (hostMapHasUrl(episodeBucket(vostfr, number))) audioLanguages.VOSTFR = watchUrl;
    return [{
      url: watchUrl,
      name,
      number: String(number),
      date: "",
      locked: false,
      audioLanguages,
    }];
  });
}

export function episodeToPlayers(episodeData, episodeNumber) {
  const players = {};
  const assign = (bucket, langKey) => {
    const hosts = episodeBucket(bucket, episodeNumber);
    if (!hosts || typeof hosts !== "object") return;
    for (const [host, rawUrl] of Object.entries(hosts)) {
      const url = String(rawUrl || "").trim();
      if (!url) continue;
      if (!players[host]) players[host] = {};
      players[host][langKey] = url;
    }
  };
  assign(episodeData?.vf, "default");
  assign(episodeData?.vostfr, "vostfr");
  assign(episodeData?.vo, "vo");
  return players;
}

function firstPlayableEpisode(episodeData) {
  const chapters = parseFrenchStreamSeriesChapters(episodeData, `${DEFAULT_BASE_URL}/index.php?newsid=1`);
  return chapters[0]?.number || "";
}

function parseEpisodeJson(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { /* maybe JS-wrapped */ }
  const match = trimmed.match(/\{[\s\S]*\}\s*$/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function seasonNumberFromTitle(title = "") {
  const match = String(title).match(/saison\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

export function pickRelatedFrenchStreamSeasons(seasons = [], currentId) {
  const current = String(currentId || "");
  return (Array.isArray(seasons) ? seasons : [])
    .filter((season) => season && String(season.id) !== current && (season.full_url || season.url))
    .sort((left, right) => seasonNumberFromTitle(left.title) - seasonNumberFromTitle(right.title))
    .map((season) => {
      const rawUrl = season.full_url || season.url || "";
      const url = normalizeFrenchStreamUrl(rawUrl.startsWith("http") || rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`);
      if (!url) return null;
      return {
        id: String(season.id),
        title: season.title,
        altTitle: String(season.title || "").match(/saison\s+\d+/i)?.[0] || "",
        url,
        cover: season.affiche || season.cover || "",
        source: SOURCE_NAME,
        sourceId: SOURCE_ID,
        mediaType: "series",
        mediaTypeLabel: "مسلسل",
        year: "",
      };
    })
    .filter(Boolean);
}

export function flattenFrenchStreamPlayers(players = {}, language = "") {
  const normalizedLanguage = String(language || "").toUpperCase();
  const langKey = normalizedLanguage === "VOSTFR"
    ? "vostfr"
    : normalizedLanguage === "VO"
      ? "vo"
      : normalizedLanguage === "VF"
        ? "default"
        : "";
  const sources = [];
  const seen = new Set();
  for (const [hostKey, variants] of Object.entries(players)) {
    if (!variants || typeof variants !== "object") continue;
    const entries = langKey
      ? Object.entries(variants).filter(([key]) => key === langKey)
      : Object.entries(variants);
    for (const [langKeyEntry, rawUrl] of entries) {
      const url = String(rawUrl || "").trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const host = PLAYER_LABELS[hostKey] || hostKey;
      const lang = LANG_LABELS[langKeyEntry] || langKeyEntry;
      sources.push({
        label: lang && lang !== "VF" ? `${host} ${lang}` : host,
        url,
        audioLabel: lang,
      });
    }
  }
  return sortSourcesByVideoHost(sources, (entry) => entry.url, PLAYER_HOST_ORDER);
}

export function frenchStreamAudioLanguagesFromPlayers(players = {}) {
  const languages = [];
  if (flattenFrenchStreamPlayers(players, "VF").length) languages.push("VF");
  if (flattenFrenchStreamPlayers(players, "VOSTFR").length) languages.push("VOSTFR");
  return languages;
}

export function parseFrenchStreamPlayback(api, details, language = "") {
  const sources = flattenFrenchStreamPlayers(api?.players, language);
  const embedUrl = sources[0]?.url || "";
  if (!embedUrl) throw new Error("تعذر استخراج مشغل الفيلم");
  return {
    title: details.title,
    url: details.url,
    kind: "video",
    embedUrl,
    playerUrl: details.url,
    sources,
  };
}

async function enrichFrenchStreamPlayback(api, details, language = "") {
  const playback = parseFrenchStreamPlayback(api, details, language);
  const sources = await enrichSourcesWithStreams(playback.sources, details.url || playback.url);
  const playable = sources.find((entry) => entry.streamUrl);
  return {
    ...playback,
    sources,
    streamUrl: playable?.streamUrl || "",
    videoUrl: playable?.streamUrl || "",
    streamReferer: playable?.streamReferer || "",
    playbackMode: playable ? "hls" : "embed",
    embedUrl: playable ? "" : playback.embedUrl,
  };
}

async function fetchFilmApi(newsId) {
  const response = await fetchWithRetries(`${DEFAULT_BASE_URL}/engine/ajax/film_api.php?id=${encodeURIComponent(newsId)}`, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      referer: `${DEFAULT_BASE_URL}/index.php?newsid=${newsId}`,
      "user-agent": BROWSER_UA,
      "x-requested-with": "XMLHttpRequest",
    },
    timeoutMs: 25_000,
  }, 2);
  if (!response.ok) throw new Error(`French Stream a répondu ${response.status}`);
  return response.json();
}

async function fetchEpisodeData(newsId) {
  const paths = [
    `${DEFAULT_BASE_URL}/static/series/${newsId}.js`,
    `${DEFAULT_BASE_URL}/assets/poster_${newsId}.json`,
    `${DEFAULT_BASE_URL}/data/eps_${newsId}.txt`,
    `${DEFAULT_BASE_URL}/ep-data.php?id=${encodeURIComponent(newsId)}&format=js`,
  ];
  let lastError = null;
  for (const path of paths) {
    try {
      const response = await fetchWithRetries(path, {
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          referer: `${DEFAULT_BASE_URL}/index.php?newsid=${newsId}`,
          "user-agent": BROWSER_UA,
        },
        timeoutMs: 25_000,
      }, 1);
      if (!response.ok) {
        lastError = new Error(`French Stream a répondu ${response.status}`);
        continue;
      }
      const parsed = parseEpisodeJson(await response.text());
      if (parsed && (parsed.vf || parsed.vostfr || parsed.vo)) return parsed;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("تعذر تحميل حلقات المسلسل");
}

async function fetchRelatedSeasons(serieTag, currentId) {
  if (!serieTag) return [];
  try {
    const response = await fetchWithRetries(
      `${DEFAULT_BASE_URL}/engine/ajax/get_seasons.php?serie_tag=${encodeURIComponent(serieTag)}&news_id=${encodeURIComponent(currentId)}`,
      {
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          referer: `${DEFAULT_BASE_URL}/index.php?newsid=${currentId}`,
          "user-agent": BROWSER_UA,
          "x-requested-with": "XMLHttpRequest",
        },
        timeoutMs: 20_000,
      },
      1,
    );
    if (!response.ok) return [];
    return pickRelatedFrenchStreamSeasons(await response.json(), currentId);
  } catch {
    return [];
  }
}

async function fetchSearchHtml(query, baseUrl = DEFAULT_BASE_URL) {
  const response = await fetchWithRetries(`${baseUrl}/engine/ajax/search.php`, {
    method: "POST",
    headers: {
      accept: "text/html, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded",
      referer: `${baseUrl}/`,
      "user-agent": BROWSER_UA,
      "x-requested-with": "XMLHttpRequest",
    },
    body: `query=${encodeURIComponent(query)}&page=1`,
    timeoutMs: 25_000,
  }, 2);
  if (!response.ok) throw new Error(`French Stream a répondu ${response.status}`);
  return response.text();
}

export async function handleFrenchStreamRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: SOURCE_NAME });
  const fetchFrenchStreamHtml = createFrenchStreamFetcher(ctx.baseUrl);

  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(assertFrenchStreamImageUrl(requestUrl.searchParams.get("url") ?? ""), `${ctx.baseUrl}/`, SOURCE_NAME);
  }

  if (requestUrl.pathname.endsWith("/stream")) {
    const target = assertFrenchStreamStreamUrl(requestUrl.searchParams.get("url") ?? "");
    const referer = assertFrenchStreamStreamReferer(requestUrl.searchParams.get("referer") ?? "");
    return fetchProxiedHlsResource({
      target,
      referer,
      label: SOURCE_NAME,
      buildProxyUrl: (entry) => buildFrenchStreamStreamProxyPath(entry, referer),
    });
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const [filmsHtml, seriesHtml] = await Promise.all([
      fetchFrenchStreamHtml(`${ctx.baseUrl}${CATALOG_PATH}`),
      fetchFrenchStreamHtml(`${ctx.baseUrl}${SERIES_PATH}`),
    ]);
    const films = parseFrenchStreamFilters(filmsHtml);
    const series = parseFrenchStreamFilters(seriesHtml, { includeSeriesGenres: true });
    const tags = [...films.tags];
    const seenTags = new Set(tags.map((entry) => entry.slug));
    for (const tag of series.tags) {
      if (seenTags.has(tag.slug)) continue;
      seenTags.add(tag.slug);
      tags.push(tag);
    }
    tags.sort((left, right) => Number(right.slug) - Number(left.slug));
    return responseJson(200, {
      kinds: [
        { slug: "all", name: "الكل", filterPath: MIXED_PATH },
        { slug: "movies", name: "أفلام", filterPath: CATALOG_PATH },
        { slug: "series", name: "مسلسلات", filterPath: SERIES_PATH },
      ],
      categories: [...films.categories, ...series.categories],
      tags,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 2000);
    const filterPath = assertFilterPath(requestUrl.searchParams.get("filterPath")?.trim() || MIXED_PATH);
    if (filterPath === MIXED_PATH) {
      const html = await fetchFrenchStreamHtml(buildCatalogUrl(page, MIXED_PATH));
      return responseJson(200, {
        items: parseFrenchStreamCatalog(html),
        page,
        hasMore: catalogHasMore(html, page),
        fetchedAt: new Date().toISOString(),
      });
    }
    const html = await fetchFrenchStreamHtml(buildCatalogUrl(page, filterPath));
    return responseJson(200, {
      items: parseFrenchStreamCatalog(html),
      page,
      hasMore: catalogHasMore(html, page),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const html = await fetchSearchHtml(query, ctx.baseUrl);
    return responseJson(200, { items: parseFrenchStreamSearch(html) });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertMovieUrl(requestUrl.searchParams.get("url") ?? "");
    const html = await fetchFrenchStreamHtml(target);
    const details = parseFrenchStreamDetails(html, target);
    if (details.mediaType === "series") {
      const episodeData = await fetchEpisodeData(details.id).catch(() => null);
      const chapters = parseFrenchStreamSeriesChapters(episodeData, details.url);
      const availableAudioLanguages = frenchStreamAudioLanguagesFromEpisodeData(episodeData);
      const relatedItems = await fetchRelatedSeasons(details.serieTag, details.id);
      return responseJson(200, applyRecentChapterFields({
        ...details,
        chapters,
        totalEpisodes: chapters.length,
        availableAudioLanguages,
        audioLabel: frenchStreamAudioLabelFromLanguages(availableAudioLanguages, details.audioLabel),
        relatedItems,
      }, [...chapters].reverse()));
    }
    const api = await fetchFilmApi(details.id).catch(() => null);
    const availableAudioLanguages = frenchStreamAudioLanguagesFromPlayers(api?.players);
    const watchUrl = details.chapters[0]?.url;
    const audioLanguages = {};
    if (watchUrl && availableAudioLanguages.includes("VF")) audioLanguages.VF = watchUrl;
    if (watchUrl && availableAudioLanguages.includes("VOSTFR")) audioLanguages.VOSTFR = watchUrl;
    const chapters = details.chapters.length
      ? [attachFrenchStreamChapterAudioLanguages(details.chapters[0], audioLanguages)]
      : details.chapters;
    return responseJson(200, {
      ...details,
      chapters,
      availableAudioLanguages,
      audioLabel: frenchStreamAudioLabelFromLanguages(availableAudioLanguages, details.audioLabel),
      relatedItems: await fetchRelatedMovies(details.title, details.id),
    });
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertChapterUrl(requestUrl.searchParams.get("url") ?? "");
    const language = requestUrl.searchParams.get("language")?.trim() || "";
    const seasonUrl = assertMovieUrl(target);
    const html = await fetchFrenchStreamHtml(seasonUrl);
    const details = parseFrenchStreamDetails(html, seasonUrl);
    if (details.mediaType === "series") {
      const episodeData = await fetchEpisodeData(details.id);
      const episode = episodeNumberFromUrl(target) || firstPlayableEpisode(episodeData);
      const players = episodeToPlayers(episodeData, episode);
      const meta = episodeBucket(episodeData?.info, episode) || {};
      const episodeTitle = String(meta.title || "").trim();
      const title = episodeTitle && !/^épisode\s+\d+$/i.test(episodeTitle)
        ? `${details.title} · ${episode} · ${episodeTitle}`
        : `${details.title} · ${episode}`;
      return responseJson(200, await enrichFrenchStreamPlayback({ players }, {
        ...details,
        title,
        url: target,
      }, language));
    }
    const api = await fetchFilmApi(details.id);
    return responseJson(200, await enrichFrenchStreamPlayback(api, details, language));
  }

  return responseJson(404, { error: "Route French Stream inconnue" });
}
