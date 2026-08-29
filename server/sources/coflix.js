import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { fetchProxiedHlsResource } from "../lib/hlsProxy.js";
import {
  assertProxiedStreamUrl,
  enrichSourcesWithStreams,
  resolveEmbedDirectStream,
} from "../lib/embedResolvers.js";
import { mergeCatalogByRecency } from "../lib/catalogMerge.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields } from "../lib/catalogChapters.js";
import { resolveRequestBaseUrl } from "../lib/sourceBaseUrl.js";
import { videoHostRank } from "../lib/videoHosts.js";

export const DEFAULT_COFLEX_BASE_URL = "https://coflix.esq";
const SOURCE_NAME = "Coflix";
const SOURCE_ID = "coflix";
const MOVIES_PATH = "/films/";
const SERIES_PATH = "/series/";
const MIXED_PATH = "/";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const IMAGE_HOSTS = new Set([
  "image.tmdb.org",
  "www.themoviedb.org",
]);

const COFLIX_MIRROR_HOST_PATTERN = /^coflix\.[a-z0-9.-]+$/i;

export function resolveCoflixContext(requestUrl) {
  const baseUrl = resolveRequestBaseUrl(requestUrl, DEFAULT_COFLEX_BASE_URL, {
    label: "URL Coflix",
    allowedHostPattern: COFLIX_MIRROR_HOST_PATTERN,
  });
  const parsed = new URL(baseUrl);
  return {
    baseUrl: parsed.origin,
    baseHost: parsed.hostname.toLowerCase(),
  };
}

function createCoflixFetcher(ctx) {
  return createCachedHtmlFetcher({
    ttlMs: 3 * 60_000,
    timeoutMs: 40_000,
    retries: 2,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.6",
      referer: `${ctx.baseUrl}/`,
      "user-agent": BROWSER_UA,
    },
    getVariants: (url) => [url],
    buildError: (lastStatus) => `Coflix a répondu ${lastStatus || "sans réponse"}`,
  });
}

function isAllowedHost(hostname = "", ctx) {
  const host = String(hostname).toLowerCase();
  return host === ctx.baseHost || host === `www.${ctx.baseHost}` || host.replace(/^www\./, "") === ctx.baseHost.replace(/^www\./, "");
}

export function assertCoflixStreamReferer(rawUrl = "", ctx) {
  const decoded = decodeHtml(String(rawUrl || "").trim());
  if (!decoded) throw new Error("مرجع البث غير صالح");
  let url;
  try {
    url = new URL(decoded, `${ctx.baseUrl}/`);
  } catch {
    throw new Error("مرجع البث غير صالح");
  }
  if (url.protocol !== "https:" || !isAllowedHost(url.hostname, ctx)) {
    throw new Error("مرجع البث غير صالح");
  }
  url.hash = "";
  return url.toString();
}

export function normalizeCoflixUrl(rawUrl = "", ctx) {
  const decoded = decodeHtml(rawUrl);
  if (!decoded) return "";
  try {
    const url = new URL(decoded, `${ctx.baseUrl}/`);
    if (url.protocol !== "https:" || !isAllowedHost(url.hostname, ctx)) return "";
    if (IMAGE_HOSTS.has(url.hostname.toLowerCase())) return url.toString();
    url.hostname = ctx.baseHost;
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function absoluteMediaUrl(raw = "", ctx) {
  const decoded = decodeHtml(raw);
  if (!decoded) return "";
  try {
    const url = new URL(decoded, `${ctx.baseUrl}/`);
    if (url.protocol !== "https:") return "";
    if (IMAGE_HOSTS.has(url.hostname.toLowerCase())) return url.toString();
    if (!isAllowedHost(url.hostname, ctx)) return "";
    url.hostname = ctx.baseHost;
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function assertCoflixContentUrl(rawUrl = "", ctx) {
  const url = normalizeCoflixUrl(rawUrl, ctx);
  if (!url) throw new Error("رابط Coflix غير صالح");
  const path = new URL(url).pathname;
  if (!/^\/(?:film|serie|series|films|wp-json|\?p=)/i.test(path) && !/\?p=\d+/.test(url)) {
    throw new Error("رابط Coflix غير صالح");
  }
  return url;
}

export function assertCoflixImageUrl(rawUrl = "", ctx) {
  const decoded = decodeHtml(rawUrl);
  if (!decoded) throw new Error("رابط الصورة غير مسموح");
  let url;
  try {
    url = new URL(decoded);
  } catch {
    throw new Error("رابط الصورة غير مسموح");
  }
  if (url.protocol !== "https:") throw new Error("رابط الصورة غير مسموح");
  const host = url.hostname.toLowerCase();
  if (IMAGE_HOSTS.has(host)) return url.toString();
  if (isAllowedHost(host, ctx)) return url.toString();
  throw new Error("رابط الصورة غير مسموح");
}

export function assertFilterPath(rawPath = MIXED_PATH) {
  const path = String(rawPath || MIXED_PATH).trim();
  if (!path.startsWith("/") || path.includes("..") || path.includes("://")) {
    throw new Error("مسار فلتر Coflix غير صالح");
  }
  if (path === MIXED_PATH) return MIXED_PATH;
  if (/^\/films\/(?:page\/\d+\/)?$/i.test(path.endsWith("/") ? path : `${path}/`)) return path.endsWith("/") ? path : `${path}/`;
  if (/^\/series\/(?:page\/\d+\/)?(?:\?.*)?$/i.test(path)) return path;
  if (/^\/genres\/\?genre=[a-z0-9-]+$/i.test(path)) return path;
  if (/^\/series\/\?/i.test(path)) return path;
  throw new Error("مسار فلتر Coflix غير صالح");
}

function contentIdFromUrl(url = "") {
  const pretty = String(url).match(/\/(?:film|serie)\/([^/?#]+)\/?/i)?.[1];
  if (pretty) return pretty;
  const postId = String(url).match(/[?&]p=(\d+)/i)?.[1];
  if (postId) return postId;
  return String(url);
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

function inferMediaType(url = "", block = "") {
  if (/\/serie\//i.test(url) || /\/series\//i.test(url)) return "series";
  if (/\/film\//i.test(url)) return "movie";
  if (/saison|episode|series/i.test(block)) return "series";
  return "movie";
}

function parseAudioLabel(block = "") {
  const flagTitle = block.match(/md-manga-card-flag[^>]*title="([^"]+)"/i)?.[1] || "";
  const text = `${flagTitle} ${block}`.toUpperCase();
  if (/VOST|SUB|VOSTFR/.test(text)) return "VOSTFR";
  if (/\bVF\b|TRUEFRENCH|FRENCH/.test(text)) return "VF";
  return "";
}

export function parseCoflixCatalog(html = "", ctx, { defaultMediaType = null } = {}) {
  const results = [];
  const seen = new Set();
  const starts = [...html.matchAll(/<div class="md-manga-card\b/gi)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const href = block.match(/<a[^>]*href="([^"]+)"/i)?.[1] || "";
    const url = normalizeCoflixUrl(href, ctx);
    const id = contentIdFromUrl(url);
    if (!url || !id || seen.has(id)) return;
    const title = textOnly(block.match(/<p class="md-manga-card-name">([\s\S]*?)<\/p>/i)?.[1] ?? "");
    if (!title) return;
    seen.add(id);
    const cover = absoluteMediaUrl(block.match(/<img[^>]*(?:data-src|src)="([^"]+)"/i)?.[1] ?? "", ctx);
    const year = textOnly(block.match(/<span class="md-card-badge year">([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const quality = textOnly(block.match(/<span class="md-card-badge quality">([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const synopsis = textOnly(block.match(/<p class="md-card-overlay-synopsis">([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const mediaType = defaultMediaType || inferMediaType(url, block);
    const audioLabel = parseAudioLabel(block);
    const chapters = mediaType === "series"
      ? [watchEntry(url, "1")]
      : [watchEntry(url, "1")];
    results.push(applyRecentChapterFields({
      id,
      title,
      altTitle: [audioLabel, year, quality].filter(Boolean).join(" · "),
      url,
      cover,
      summary: synopsis,
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType,
      mediaTypeLabel: mediaType === "series" ? "مسلسل" : "فيلم",
      audioLabel,
      year,
    }, chapters));
  });
  return results;
}

export function parseCoflixSearch(html = "", ctx) {
  return parseCoflixCatalog(html, ctx);
}

export function parseCoflixFilters(html = "", ctx) {
  const categories = [];
  const tags = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    if (!href) continue;
    let target;
    try {
      target = new URL(href, `${ctx.baseUrl}/`);
    } catch {
      continue;
    }
    if (!isAllowedHost(target.hostname, ctx)) continue;
    const genre = target.searchParams.get("genre");
    if (!genre || !target.pathname.includes("/genres")) continue;
    const name = textOnly(match[2]).replace(/^#/, "").trim();
    if (!name || seen.has(genre)) continue;
    seen.add(genre);
    categories.push({
      slug: genre,
      name,
      count: 0,
      filterPath: `/genres/?genre=${encodeURIComponent(genre)}`,
    });
  }
  return { categories, tags };
}

export function catalogHasMore(html, page, filterPath = MOVIES_PATH) {
  const nextPage = page + 1;
  if (filterPath.startsWith("/genres/")) {
    return new RegExp(`page/${nextPage}/`, "i").test(html) || /class="md-page-next"/i.test(html);
  }
  const base = filterPath.endsWith("/") ? filterPath.slice(0, -1) : filterPath;
  return new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/page/${nextPage}/`, "i").test(html)
    || /class="md-page-next"/i.test(html);
}

export function buildCatalogUrl(page, filterPath = MOVIES_PATH, ctx) {
  const path = assertFilterPath(filterPath);
  if (path === MIXED_PATH) {
    return page <= 1 ? `${ctx.baseUrl}/` : `${ctx.baseUrl}/page/${page}/`;
  }
  if (path.startsWith("/genres/")) {
    return `${ctx.baseUrl}${path}`;
  }
  const normalized = path.endsWith("/") ? path : `${path}/`;
  if (page <= 1) return `${ctx.baseUrl}${normalized}`;
  const trimmed = normalized.replace(/\/+$/, "");
  return `${ctx.baseUrl}${trimmed}/page/${page}/`;
}

function parseSynopsis(html = "") {
  return textOnly(
    html.match(/<div[^>]*class="[^"]*synopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
      ?? html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]
      ?? "",
  );
}

function parseDetailsYear(html = "") {
  return textOnly(
    html.match(/<span class="md-card-badge year">([\s\S]*?)<\/span>/i)?.[1]
      ?? html.match(/\((\d{4})\)/)?.[1]
      ?? "",
  );
}

export function parseCoflixEpisodes(html = "", baseUrl = "") {
  const chapters = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    if (!/\/(?:episode|saison|season)/i.test(href) && !/ep(?:isode)?[-=]\d+/i.test(href)) continue;
    const url = normalizeCoflixUrl(href, { baseUrl, baseHost: new URL(baseUrl).hostname });
    if (!url || seen.has(url)) continue;
    const label = textOnly(match[2]) || textOnly(match[1].match(/title="([^"]+)"/i)?.[1] ?? "");
    const number = label.match(/(\d+)/)?.[1] || String(chapters.length + 1);
    seen.add(url);
    chapters.push(watchEntry(url, number));
  }
  return chapters.sort((left, right) => Number(left.number) - Number(right.number));
}

export function parseCoflixDetails(html, url, ctx) {
  const canonical = assertCoflixContentUrl(url, ctx);
  const id = contentIdFromUrl(canonical);
  const title = textOnly(
    html.match(/<h1[^>]*class="[^"]*md-hero-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.split("|")[0]
      ?? "",
  ).replace(/\s+en streaming.*$/i, "").replace(/\s*\|\s*Coflix.*$/i, "").trim();
  const cover = absoluteMediaUrl(
    html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1]
      ?? html.match(/<img[^>]*class="[^"]*md-hero-cover[^"]*"[^>]*src="([^"]+)"/i)?.[1]
      ?? "",
    ctx,
  );
  const year = parseDetailsYear(html);
  const series = inferMediaType(canonical, html) === "series";
  const chapters = series
    ? (parseCoflixEpisodes(html, ctx.baseUrl).length
      ? parseCoflixEpisodes(html, ctx.baseUrl)
      : [watchEntry(canonical, "1")])
    : [watchEntry(canonical, "1")];
  const audioLabel = parseAudioLabel(html);
  return {
    id,
    title,
    altTitle: [year, audioLabel].filter(Boolean).join(" · "),
    cover,
    summary: parseSynopsis(html),
    url: canonical,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: series ? "series" : "movie",
    mediaTypeLabel: series ? "مسلسل" : "فيلم",
    audioLabel,
    categories: [],
    tags: [audioLabel].filter(Boolean),
    totalEpisodes: chapters.length,
    year,
    relatedItems: [],
    chapters,
    latestChapter: chapters[chapters.length - 1]?.number || "—",
    latestChapterUrl: chapters[chapters.length - 1]?.url || canonical,
    recentChapters: [],
  };
}

function hostRank(url = "") {
  return videoHostRank(url);
}

function isHttpUrl(value = "") {
  return /^https:\/\//i.test(String(value || "").trim());
}

export function parseCoflixPlayers(html = "") {
  const sources = [];
  const seen = new Set();
  const push = (url, label = "") => {
    const target = String(url || "").trim();
    if (!isHttpUrl(target) || seen.has(target)) return;
    seen.add(target);
    sources.push({
      label: label || (() => {
        try { return new URL(target).hostname.replace(/^www\./, ""); } catch { return "Lecteur"; }
      })(),
      url: target,
    });
  };

  for (const match of html.matchAll(/<iframe[^>]+src=(['"])([^'"]+)\1/gi)) {
    push(decodeHtml(match[2]));
  }
  for (const match of html.matchAll(/data-(?:url|src|link)=(['"])(https?:\/\/[^'"]+)\1/gi)) {
    push(decodeHtml(match[2]));
  }
  for (const match of html.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    const url = decodeHtml(match[0]);
    if (/uqload|vidzy|filemoon|voe\.sx|dood|fsvid|embed/i.test(url)) push(url);
  }

  return sources.sort((left, right) => hostRank(left.url) - hostRank(right.url));
}

export function parseCoflixPlayback(html, details) {
  const sources = parseCoflixPlayers(html);
  const embedUrl = sources[0]?.url || "";
  if (!embedUrl) throw new Error("تعذر استخراج مشغل الفيلم");
  return {
    title: details.title,
    url: details.url,
    kind: "video",
    embedUrl,
    playerUrl: details.url,
    sources,
    playbackMode: "embed",
  };
}

function buildCoflixStreamProxyPath(targetUrl, referer = "") {
  const params = new URLSearchParams({ url: targetUrl });
  if (referer) params.set("referer", referer);
  return `/api/sources/${SOURCE_ID}/stream?${params}`;
}

async function enrichCoflixPlayback(html, details, ctx) {
  let playback;
  try {
    playback = parseCoflixPlayback(html, details);
  } catch {
    return {
      title: details.title,
      url: details.url,
      kind: "video",
      embedUrl: "",
      playerUrl: details.url,
      sources: [],
      playbackMode: "embed",
    };
  }
  const enriched = await enrichSourcesWithStreams(playback.sources, {
    referer: details.url,
    buildProxyUrl: (entry) => buildCoflixStreamProxyPath(entry, details.url),
    resolveDirect: resolveEmbedDirectStream,
  });
  const primary = enriched[0];
  const streamUrl = primary?.streamUrl || "";
  const playable = Boolean(streamUrl);
  return {
    ...playback,
    sources: enriched,
    streamUrl: playable ? streamUrl : "",
    playbackMode: playable ? "hls" : "embed",
    embedUrl: playable ? "" : playback.embedUrl,
  };
}

function interleaveCatalog(left = [], right = []) {
  const items = [];
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    if (left[index]) items.push(left[index]);
    if (right[index]) items.push(right[index]);
  }
  return items;
}

export async function handleCoflixRequest(requestUrl) {
  const ctx = resolveCoflixContext(requestUrl);
  const fetchCoflixHtml = createCoflixFetcher(ctx);

  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(
      assertCoflixImageUrl(requestUrl.searchParams.get("url") ?? "", ctx),
      `${ctx.baseUrl}/`,
      SOURCE_NAME,
    );
  }

  if (requestUrl.pathname.endsWith("/stream")) {
    const target = assertProxiedStreamUrl(requestUrl.searchParams.get("url") ?? "");
    const referer = assertCoflixStreamReferer(requestUrl.searchParams.get("referer") ?? `${ctx.baseUrl}/`, ctx);
    return fetchProxiedHlsResource({
      target,
      referer,
      label: SOURCE_NAME,
      buildProxyUrl: (entry) => buildCoflixStreamProxyPath(entry, referer),
    });
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const html = await fetchCoflixHtml(`${ctx.baseUrl}/genres/`);
    const parsed = parseCoflixFilters(html, ctx);
    return responseJson(200, {
      kinds: [
        { slug: "all", name: "الكل", filterPath: MIXED_PATH },
        { slug: "movies", name: "أفلام", filterPath: MOVIES_PATH },
        { slug: "series", name: "مسلسلات", filterPath: SERIES_PATH },
      ],
      categories: parsed.categories,
      tags: parsed.tags,
      baseUrl: ctx.baseUrl,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 2000);
    const filterPath = assertFilterPath(requestUrl.searchParams.get("filterPath")?.trim() || MIXED_PATH);
    if (filterPath === MIXED_PATH) {
      const [filmsHtml, seriesHtml] = await Promise.all([
        fetchCoflixHtml(buildCatalogUrl(page, MOVIES_PATH, ctx)),
        fetchCoflixHtml(buildCatalogUrl(page, SERIES_PATH, ctx)),
      ]);
      const items = mergeCatalogByRecency(
        parseCoflixCatalog(filmsHtml, ctx, { defaultMediaType: "movie" }),
        parseCoflixCatalog(seriesHtml, ctx, { defaultMediaType: "series" }),
      );
      return responseJson(200, {
        items,
        page,
        hasMore: catalogHasMore(filmsHtml, page, MOVIES_PATH) || catalogHasMore(seriesHtml, page, SERIES_PATH),
        baseUrl: ctx.baseUrl,
        fetchedAt: new Date().toISOString(),
      });
    }
    const defaultMediaType = filterPath.startsWith(SERIES_PATH) ? "series" : "movie";
    const html = await fetchCoflixHtml(buildCatalogUrl(page, filterPath, ctx));
    return responseJson(200, {
      items: parseCoflixCatalog(html, ctx, { defaultMediaType }),
      page,
      hasMore: catalogHasMore(html, page, filterPath),
      baseUrl: ctx.baseUrl,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [], baseUrl: ctx.baseUrl });
    const html = await fetchCoflixHtml(`${ctx.baseUrl}/?s=${encodeURIComponent(query)}`);
    return responseJson(200, { items: parseCoflixSearch(html, ctx), baseUrl: ctx.baseUrl });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertCoflixContentUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    const html = await fetchCoflixHtml(target);
    const details = parseCoflixDetails(html, target, ctx);
    return responseJson(200, applyRecentChapterFields({
      ...details,
      totalEpisodes: details.chapters.length,
    }, details.mediaType === "series" ? [...details.chapters].reverse() : details.chapters));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertCoflixContentUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    const html = await fetchCoflixHtml(target);
    const details = parseCoflixDetails(html, target, ctx);
    const playback = await enrichCoflixPlayback(html, details, ctx);
    return responseJson(200, {
      ...playback,
      pages: [],
      audioLanguages: details.audioLabel ? { [details.audioLabel]: target } : {},
    });
  }

  return responseJson(404, { error: "مسار Coflix غير معروف" });
}
