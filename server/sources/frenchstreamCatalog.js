import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { fetchWithRetries } from "../lib/httpUtils.js";
import { applyRecentChapterFields, enrichCatalogItems } from "../lib/catalogChapters.js";
import { mergeCatalogByRecency } from "../lib/catalogMerge.js";
import { collectCatalogPool } from "../lib/catalogPool.js";
import {
  assertFilterPath,
  CATALOG_PATH,
  DEFAULT_BASE_URL,
  episodeUrl,
  isAllowedHost,
  isMixedCatalogPath,
  isSeriesCard,
  isSeriesSearchHit,
  MIXED_PATH,
  newsIdFromUrl,
  normalizeFrenchStreamAudioLabel,
  normalizeFrenchStreamUrl,
  parseCardVersion,
  parseEpisodeProgress,
  SERIES_PATH,
  seriesCatalogChapters,
  SOURCE_ID,
  SOURCE_NAME,
  watchEntry,
  FRENCH_STREAM_UPSTREAM_PAGE_HINT,
} from "./frenchstreamCore.js";
import {
  fetchFrenchStreamEpisodeData,
  frenchStreamSeriesNeedsEnrich,
  getFrenchStreamEpisodeDataCache,
  recentChaptersFromEpisodeData,
} from "./frenchstreamEpisodes.js";

export const FRENCH_STREAM_CATALOG_PAGE_SIZE = 20;
const FRENCH_STREAM_FILTERS_CACHE_TTL_MS = 30 * 60_000;
const FRENCH_STREAM_SEARCH_CACHE_TTL_MS = 60_000;
const frenchStreamFiltersCache = new Map();
const frenchStreamSearchCache = new Map();

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
    const titleRaw = textOnly(
      block.match(/<div class="short-title">([\s\S]*?)<\/div>/i)?.[1]
        || block.match(/alt="([^"]+)"/i)?.[1]
        || "",
    ).replace(/\s+affiche\s*$/i, "").trim();
    if (!titleRaw) return;
    const year = titleRaw.match(/\((\d{4})\)\s*$/)?.[1] || "";
    const title = year ? titleRaw.replace(/\s*\(\d{4}\)\s*$/, "").trim() : titleRaw;
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
      year,
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType: series ? "series" : "movie",
      mediaTypeLabel: series ? "مسلسل" : "فيلم",
      audioLabel,
    }, chapters));
  });
  return results;
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

function catalogHasMore(html, page) {
  return new RegExp(`cstart=${page + 1}\\b|/page/${page + 1}/`, "i").test(html);
}

function buildCatalogUrl(page, filterPath = CATALOG_PATH, baseUrl = DEFAULT_BASE_URL) {
  const path = assertFilterPath(filterPath);
  if (page <= 1) return `${baseUrl}${path}`;
  if (path.startsWith("/xfsearch/")) {
    const trimmed = path.endsWith("/") ? path : `${path}/`;
    return `${baseUrl}${trimmed}page/${page}/`;
  }
  const category = path.replace(/^\/+|\/+$/g, "").split("/").pop() || "films";
  return `${baseUrl}/index.php?cstart=${page}&do=cat&category=${encodeURIComponent(category)}`;
}

async function fetchFrenchStreamCatalogUpstream(upstreamPage, filterPath, fetchHtml, baseUrl) {
  const html = await fetchHtml(buildCatalogUrl(upstreamPage, filterPath, baseUrl));
  return {
    html,
    items: parseFrenchStreamCatalog(html),
    hasMore: catalogHasMore(html, upstreamPage),
  };
}

async function fetchFrenchStreamMixedCatalogUpstream(upstreamPage, fetchHtml, baseUrl) {
  const [films, series] = await Promise.all([
    fetchFrenchStreamCatalogUpstream(upstreamPage, CATALOG_PATH, fetchHtml, baseUrl),
    fetchFrenchStreamCatalogUpstream(upstreamPage, SERIES_PATH, fetchHtml, baseUrl),
  ]);
  return {
    items: mergeCatalogByRecency(films.items, series.items),
    hasMore: films.hasMore || series.hasMore,
  };
}

export async function enrichFrenchStreamCatalog(items, { fetchEpisodes } = {}) {
  const queue = items.filter((item) => item?.url && frenchStreamSeriesNeedsEnrich(item));
  if (!queue.length) return items;

  return enrichCatalogItems(items, {
    concurrency: 6,
    needsEnrich: frenchStreamSeriesNeedsEnrich,
    enrichItem: async (item) => {
      const cached = getFrenchStreamEpisodeDataCache(item.id);
      if (cached) {
        return recentChaptersFromEpisodeData(cached.data, item.url);
      }
      const episodeData = fetchEpisodes
        ? await fetchEpisodes(item.id).catch(() => null)
        : await fetchFrenchStreamEpisodeData(item.id, { fast: true }).catch(() => null);
      if (!episodeData) return [];
      return recentChaptersFromEpisodeData(episodeData, item.url);
    },
  });
}

export async function fetchFrenchStreamCatalogPage(ctx, fetchHtml, {
  page = 1,
  filterPath = MIXED_PATH,
  fetchEpisodes,
} = {}) {
  const normalized = assertFilterPath(filterPath?.trim() || MIXED_PATH);
  const offset = (page - 1) * FRENCH_STREAM_CATALOG_PAGE_SIZE;
  const fetchUpstream = isMixedCatalogPath(normalized)
    ? (upstreamPage) => fetchFrenchStreamMixedCatalogUpstream(upstreamPage, fetchHtml, ctx.baseUrl)
    : (upstreamPage) => fetchFrenchStreamCatalogUpstream(upstreamPage, normalized, fetchHtml, ctx.baseUrl);
  const maxUpstreamEnd = page + 6;
  const collected = await collectCatalogPool(fetchUpstream, {
    offset,
    pageSize: FRENCH_STREAM_CATALOG_PAGE_SIZE,
    maxUpstreamEnd,
    upstreamPageHint: FRENCH_STREAM_UPSTREAM_PAGE_HINT,
  });
  const items = collected.sliced
    ? collected.pool.slice(0, FRENCH_STREAM_CATALOG_PAGE_SIZE)
    : collected.pool.slice(offset, offset + FRENCH_STREAM_CATALOG_PAGE_SIZE);
  const hasMoreUpstream = collected.hasMoreUpstream;

  await enrichFrenchStreamCatalog(items, fetchEpisodes ? { fetchEpisodes } : undefined);

  return {
    items,
    page,
    filterPath: normalized,
    hasMore: items.length === FRENCH_STREAM_CATALOG_PAGE_SIZE && (
      collected.sliced
        ? collected.pool.length > FRENCH_STREAM_CATALOG_PAGE_SIZE || hasMoreUpstream
        : collected.pool.length > offset + items.length || hasMoreUpstream
    ),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchFrenchStreamFilters(fetchHtml, baseUrl) {
  const cached = frenchStreamFiltersCache.get(baseUrl);
  if (cached && Date.now() - cached.at < FRENCH_STREAM_FILTERS_CACHE_TTL_MS) return cached.data;
  const [filmsHtml, seriesHtml] = await Promise.all([
    fetchHtml(`${baseUrl}${CATALOG_PATH}`),
    fetchHtml(`${baseUrl}${SERIES_PATH}`),
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
  const data = {
    kinds: [
      { slug: "all", name: "الكل", filterPath: MIXED_PATH },
      { slug: "movies", name: "أفلام", filterPath: CATALOG_PATH },
      { slug: "series", name: "مسلسلات", filterPath: SERIES_PATH },
    ],
    categories: [...films.categories, ...series.categories],
    tags,
    fetchedAt: new Date().toISOString(),
  };
  frenchStreamFiltersCache.set(baseUrl, { at: Date.now(), data });
  return data;
}

export function clearFrenchStreamCatalogCaches() {
  frenchStreamFiltersCache.clear();
  frenchStreamSearchCache.clear();
}

export async function fetchFrenchStreamSearchHtml(query, baseUrl = DEFAULT_BASE_URL, page = 1) {
  const response = await fetchWithRetries(`${baseUrl}/engine/ajax/search.php`, {
    method: "POST",
    headers: {
      accept: "text/html, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded",
      referer: `${baseUrl}/`,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "x-requested-with": "XMLHttpRequest",
    },
    body: `query=${encodeURIComponent(query)}&page=${Math.max(1, page)}`,
    timeoutMs: 25_000,
  }, 2);
  if (!response.ok) throw new Error(`French Stream a répondu ${response.status}`);
  return response.text();
}

export async function fetchFrenchStreamSearchHtmlCached(query, baseUrl = DEFAULT_BASE_URL, page = 1) {
  const key = `${baseUrl}|${page}|${query}`;
  const cached = frenchStreamSearchCache.get(key);
  if (cached && Date.now() - cached.at < FRENCH_STREAM_SEARCH_CACHE_TTL_MS) {
    return cached.html;
  }
  const html = await fetchFrenchStreamSearchHtml(query, baseUrl, page);
  frenchStreamSearchCache.set(key, { at: Date.now(), html });
  return html;
}

export function searchHasMore(html = "", page = 1, itemCount = 0) {
  if (itemCount >= FRENCH_STREAM_CATALOG_PAGE_SIZE) return true;
  return new RegExp(`(?:[?&]page=|&page=)${page + 1}\\b`, "i").test(html);
}

export async function fetchRelatedFrenchStreamMovies(title, currentId, baseUrl = DEFAULT_BASE_URL) {
  const query = relatedSearchQuery(title);
  if (query.length < 3) return [];
  try {
    const html = await fetchFrenchStreamSearchHtml(query, baseUrl);
    return pickRelatedFrenchStreamMovies(parseFrenchStreamSearch(html), {
      currentId,
      currentTitle: title,
      query,
    });
  } catch {
    return [];
  }
}

export { frenchStreamSeriesNeedsEnrich };
