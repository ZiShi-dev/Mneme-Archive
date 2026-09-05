import { publicFetch } from "../lib/publicFetch.js";
import { decodeHtml, mergeFilterGroups, parseDetailTaxonomies, parseTaxonomyFilterLinks, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/responseJson.js";
import { applyRecentChapterFields, catalogNeedsRecentEnrich, enrichCatalogItems, recentChaptersFromCount, recentChaptersFromList } from "../lib/catalogChapters.js";
import { normalizeChapterList, extractChapterNumberFromUrl } from "../lib/chapterOrdering.js";
import { enrichChapterDates } from "../lib/chapterDates.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import { filterNovelParagraphs } from "../lib/novelChapterText.js";
import { catalogEnrichFromSearchParams } from "../lib/catalogEnrichPolicy.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";
import { configureSourceNativeFetch, fetchNativeHtml, fetchNativeImage, hasNativeHtmlFetcher } from "../lib/nativeFetchBridge.js";
import { isCloudflareChallengeHtml } from "../lib/cloudflareDetect.js";

const DEFAULT_BASE_URL = "https://galaxynovels.com";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
/** Même densité que Realm Novel / MangaLik. */
export const GALAXY_CATALOG_PAGE_SIZE = 24;
const UPSTREAM_LIBRARY_PAGE_SIZE = 12;
const GALAXY_FILTERS_CACHE_TTL_MS = 30 * 60_000;
const GALAXY_JSON_TTL_MS = 10 * 60_000;
const GALAXY_INDEX_TTL_MS = 5 * 60_000;
const GALAXY_CHAPTER_API_TTL_MS = 5 * 60_000;
const GALAXY_JSON_HEADERS = (baseUrl = DEFAULT_BASE_URL) => ({
  accept: "application/json",
  "accept-language": "ar,en;q=0.8",
  referer: `${baseUrl}/`,
  "user-agent": "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36 Chrome/124 Safari/537.36",
});
const GALAXY_AUTHOR_FILTERS_TTL_MS = 30 * 60_000;
const GALAXY_AUTHOR_FETCH_CONCURRENCY = 20;
const GALAXY_AUTHOR_FILTER_QUICK_PAGES = 2;
const GALAXY_AUTHOR_FILTER_MAX_PAGES = 20;
const GALAXY_INVALID_AUTHORS = new Set(["غير متوفر", "n/a", "na", "unknown", "—", "-"]);
const galaxyIndexCache = new Map();
const galaxyManifestCache = new Map();
const galaxyNovelApiCache = new Map();
const galaxyChapterApiCache = new Map();
const galaxyTaxonomyFiltersCache = new Map();
let galaxyAuthorFiltersCache = null;
let galaxyAuthorFiltersWarmPromise = null;

export function configureGalaxynovelsNativeFetch(options) {
  configureSourceNativeFetch(options);
}

function createFetcher(baseUrl = DEFAULT_BASE_URL) {
  const fetchHtmlRemote = createCachedHtmlFetcher({
    ttlMs: 3 * 60_000,
    timeoutMs: 40_000,
    headers: { accept: "text/html,application/xhtml+xml", "accept-language": "ar,en;q=0.8", referer: `${baseUrl}/`, "user-agent": "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36 Chrome/124 Safari/537.36" },
    getVariants: (url) => [url],
    buildError: (lastStatus) => (lastStatus === 403 ? "حماية Galaxy Novels منعت الاتصال مؤقتًا" : `Galaxy Novels a répondu ${lastStatus}`),
  });
  return async function fetchGalaxyHtml(url) {
    const html = await fetchNativeHtml(url, () => fetchHtmlRemote(url));
    const looksValid = (value) => galaxyPageHtmlLooksValid(value, url);
    if (!hasNativeHtmlFetcher()) {
      if (isCloudflareChallengeHtml(html)) throw new Error("حماية Galaxy Novels تمنع الاتصال (Cloudflare)");
      return html;
    }
    if (looksValid(html)) return html;
    try {
      const remote = await fetchHtmlRemote(url);
      if (looksValid(remote)) return remote;
    } catch {
      // Garde le HTML WebView si le repli HTTP échoue aussi.
    }
    if (isCloudflareChallengeHtml(html)) throw new Error("حماية Galaxy Novels تمنع الاتصال (Cloudflare)");
    return html;
  };
}

function toGalaxyAbsoluteUrl(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(decodeHtml(String(rawUrl || "")), ctx.baseUrl);
  url.hostname = ctx.apex;
  url.hash = "";
  return url.toString();
}

function assertGalaxyUrl(rawUrl, chapter = false, ctx = DEFAULT_CTX) {
  const url = new URL(toGalaxyAbsoluteUrl(rawUrl, ctx));
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) throw new Error("المصدر غير مسموح");
  const parts = url.pathname.split("/").filter(Boolean);
  const validNovel = parts[0] === "novel" && parts.length === 2;
  const validChapter = parts[0] === "novel" && parts.length >= 3 && /^chapter-[\w.-]+$/i.test(parts[2]);
  if (chapter ? !validChapter : !validNovel) throw new Error("رابط Galaxy Novels غير صالح");
  return url.toString();
}

function assertGalaxyImageUrl(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ctx.hostPattern.test(url.hostname) || !url.pathname.startsWith("/wp-content/uploads/")) throw new Error("رابط الصورة غير مسموح");
  return url.toString();
}

async function proxyGalaxyImage(rawUrl, ctx = DEFAULT_CTX) {
  const target = assertGalaxyImageUrl(rawUrl, ctx);
  return fetchNativeImage(target, () => fetchProxiedImage(target, `${ctx.baseUrl}/`, "Galaxy Novels"));
}

async function fetchGalaxyNovelApi(novelId, baseUrl = DEFAULT_BASE_URL) {
  const cacheKey = `${baseUrl}/wp-json/wor-reader-app/v1/novels/${novelId}`;
  const cached = galaxyNovelApiCache.get(cacheKey);
  if (cached && Date.now() - cached.at < GALAXY_JSON_TTL_MS) return cached.data;
  const response = await publicFetch(cacheKey, {
    headers: GALAXY_JSON_HEADERS(baseUrl),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`واجهة رواية Galaxy Novels غير متاحة (${response.status})`);
  const payload = await response.json();
  const data = payload?.data || payload || {};
  galaxyNovelApiCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

export function normalizeGalaxyChapterList(chapters = []) {
  return enrichChapterDates(normalizeChapterList(chapters));
}

export function mapGalaxyChapterEntry(chapter = {}, ctx = DEFAULT_CTX) {
  const url = chapter.url ? toGalaxyAbsoluteUrl(chapter.url, ctx) : "";
  const number = String(
    extractChapterNumberFromUrl(url)
    || chapter.number
    || chapter.position
    || "",
  ).trim();
  if (!url || !number) return null;
  const title = textOnly(chapter.title || chapter.label || "");
  const name = title && title !== number
    ? `${number} · ${title}`
    : String(chapter.name || title || number);
  const publishedAt = chapter.date_iso || chapter.publishedAt || chapter.date || "";
  return {
    url,
    name,
    number,
    date: chapter.date || chapter.date_iso || "",
    publishedAt: publishedAt || "",
    locked: Boolean(chapter.locked),
    contentApi: chapter.content_api || chapter.contentApi
      ? toGalaxyAbsoluteUrl(chapter.content_api || chapter.contentApi, ctx)
      : "",
    ...(chapter.author ? { author: chapter.author } : {}),
  };
}

export function mapGalaxyChapters(index, ctx = DEFAULT_CTX) {
  return normalizeGalaxyChapterList(
    [...(index?.chapters || [])]
      .map((chapter) => mapGalaxyChapterEntry(chapter, ctx))
      .filter(Boolean),
  );
}

function parseGalaxyAuthorFromHtml(html) {
  return textOnly(html.match(/مؤلف الرواية:\s*<span>([\s\S]*?)<\/span>/i)?.[1] ?? html.match(/"author"\s*:\s*"([^"]+)"/i)?.[1] ?? "");
}

function slugifyGalaxyAuthor(name) {
  return String(name || "").trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/gi, "-").replace(/^-+|-+$/g, "") || "author";
}

export function parseGalaxyCatalogNovelIds(html) {
  return [...new Set([...html.matchAll(/data-wor-library-novel-id=["'](\d+)["']/gi)].map((match) => Number(match[1])).filter(Boolean))];
}

function galaxyPageHtmlLooksValid(html = "", url = "") {
  if (!html || isCloudflareChallengeHtml(html)) return false;
  if (/\/novel\/[^/]+\/chapter-/i.test(url)) {
    return /wor-reader|wor-chapter-content|chapter-content|reading-content|text-chapter/i.test(html);
  }
  return /data-wor-library-novel-id|wor-library-card|wor-single-novel|wor-reader/i.test(html);
}

function imageFromGalaxyTag(tag = "") {
  const direct = tag.match(/(?:data-src|data-lazy-src|src)=["']([^"']+)["']/gi) ?? [];
  for (const match of direct) {
    const value = match.match(/=["']([^"']+)["']/i)?.[1] ?? "";
    if (value && !/^data:/i.test(value)) return decodeHtml(value);
  }
  return "";
}

function extractGalaxyNovelLink(block = "") {
  const titleLink = block.match(/<h2[^>]*class=["'][^"']*wor-library-card__title[^"']*["'][^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (titleLink) return { url: titleLink[1], title: titleLink[2] };
  const coverLink = block.match(/<a[^>]*class=["'][^"']*wor-library-card__cover[^"']*["'][^>]*href=["']([^"']+)["'][^>]*(?:aria-label=["']([^"']*)["'])?/i);
  if (coverLink) return { url: coverLink[1], title: coverLink[2] || "" };
  const generic = block.match(/<a[^>]*href=["']([^"']+\/novel\/[^"']+\/?)["'][^>]*>/i);
  if (generic) return { url: generic[1], title: "" };
  return null;
}

export function parseGalaxyCatalog(html = "", ctx = DEFAULT_CTX) {
  const results = [];
  const seen = new Set();
  for (const match of html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)) {
    const attrs = match[1];
    const block = match[2];
    if (!/\bwor-library-card\b/.test(attrs) && !/data-wor-library-novel-id=/i.test(attrs)) continue;
    const novelId = Number(
      attrs.match(/data-wor-library-novel-id=["'](\d+)["']/i)?.[1]
      ?? block.match(/data-wor-library-novel-id=["'](\d+)["']/i)?.[1]
      ?? 0,
    );
    const link = extractGalaxyNovelLink(block);
    if (!link?.url) continue;
    const url = toGalaxyAbsoluteUrl(link.url, ctx);
    if (seen.has(url)) continue;
    const imageTag = block.match(/<img[^>]*class=["'][^"']*wor-cover-img[^"']*["'][^>]*>/i)?.[0]
      ?? block.match(/<img[^>]*>/i)?.[0]
      ?? "";
    const chapterCount = textOnly(block.match(/<b[^>]*data-wor-library-chapter-count[^>]*>([\s\S]*?)<\/b>/i)?.[1] ?? "0");
    const status = textOnly(block.match(/<b>([^<]+)<\/b><small>الحالة<\/small>/i)?.[1] ?? "");
    const summary = textOnly(block.match(/<div[^>]*class=["'][^"']*wor-single-summary__text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
    const slug = new URL(url).pathname.split("/").filter(Boolean).pop();
    const count = Number(chapterCount) || 0;
    const recentChapters = count > 0 && slug
      ? recentChaptersFromCount(count, (number) => toGalaxyAbsoluteUrl(`/novel/${slug}/chapter-${number}/`, ctx))
      : [];
    seen.add(url);
    results.push(applyRecentChapterFields({
      id: slug,
      novelId,
      title: textOnly(link.title),
      url,
      cover: imageFromGalaxyTag(imageTag),
      summary,
      chapterCount: count,
      status,
      source: "Galaxy Novels",
      sourceId: "galaxynovels",
      mediaType: "novel",
      mediaTypeLabel: "رواية",
    }, recentChapters));
  }
  return results;
}

export function normalizeGalaxyAuthorName(name) {
  return textOnly(name).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
}

function isValidGalaxyAuthorName(name) {
  const normalized = normalizeGalaxyAuthorName(name);
  if (!normalized || normalized.length > 80) return false;
  const key = normalized.toLocaleLowerCase("ar");
  if (GALAXY_INVALID_AUTHORS.has(key)) return false;
  if (/^(?:غير\s*متوفر|not\s*available|unknown)$/i.test(normalized)) return false;
  return true;
}

export function galaxyAuthorFilterEntry(name, count = 0) {
  const label = normalizeGalaxyAuthorName(name);
  return {
    slug: slugifyGalaxyAuthor(label),
    name: label,
    count,
    filterPath: "/library/",
    queryParam: "author",
    queryValue: label,
  };
}

export function buildGalaxyAuthorFilterEntries(authorCounts) {
  return [...authorCounts.entries()]
    .filter(([name, count]) => isValidGalaxyAuthorName(name) && count > 0)
    .sort((a, b) => a[0].localeCompare(b[0], "ar"))
    .map(([name, count]) => galaxyAuthorFilterEntry(name, count));
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function collectGalaxyLibraryNovelIds(fetchGalaxyHtml, baseUrl = DEFAULT_BASE_URL, maxPages = 200) {
  const novelIds = new Set();
  const pageLimit = Math.max(1, Math.min(maxPages, 200));
  for (let page = 1; page <= pageLimit; page += 1) {
    const html = await fetchGalaxyHtml(`${baseUrl}/library/?library_page=${page}`);
    const pageIds = parseGalaxyCatalogNovelIds(html);
    if (!pageIds.length) break;
    pageIds.forEach((novelId) => novelIds.add(novelId));
  }
  return [...novelIds];
}

async function collectGalaxyAuthorCounts(novelIds) {
  const counts = new Map();
  await mapWithConcurrency(novelIds, GALAXY_AUTHOR_FETCH_CONCURRENCY, async (novelId) => {
    try {
      const api = await fetchGalaxyNovelApi(novelId);
      const author = normalizeGalaxyAuthorName(api.author || "");
      if (!isValidGalaxyAuthorName(author)) return;
      counts.set(author, (counts.get(author) || 0) + 1);
    } catch { /* Ignore les romans indisponibles. */ }
  });
  return counts;
}

async function buildGalaxyAuthorFilters(fetchGalaxyHtml, baseUrl = DEFAULT_BASE_URL, maxPages = GALAXY_AUTHOR_FILTER_MAX_PAGES) {
  if (
    maxPages >= GALAXY_AUTHOR_FILTER_MAX_PAGES
    && galaxyAuthorFiltersCache
    && galaxyAuthorFiltersCache.key === baseUrl
    && Date.now() - galaxyAuthorFiltersCache.at < GALAXY_AUTHOR_FILTERS_TTL_MS
  ) {
    return galaxyAuthorFiltersCache.data;
  }
  const novelIds = await collectGalaxyLibraryNovelIds(fetchGalaxyHtml, baseUrl, maxPages);
  const authors = buildGalaxyAuthorFilterEntries(await collectGalaxyAuthorCounts(novelIds));
  if (maxPages >= GALAXY_AUTHOR_FILTER_MAX_PAGES) {
    galaxyAuthorFiltersCache = { key: baseUrl, at: Date.now(), data: authors };
  }
  return authors;
}

function warmGalaxyAuthorFilters(fetchGalaxyHtml, baseUrl = DEFAULT_BASE_URL) {
  if (galaxyAuthorFiltersWarmPromise) return galaxyAuthorFiltersWarmPromise;
  galaxyAuthorFiltersWarmPromise = buildGalaxyAuthorFilters(
    fetchGalaxyHtml,
    baseUrl,
    GALAXY_AUTHOR_FILTER_MAX_PAGES,
  ).finally(() => {
    galaxyAuthorFiltersWarmPromise = null;
  });
  return galaxyAuthorFiltersWarmPromise;
}

async function fetchGalaxyChapterManifest(novelId, baseUrl = DEFAULT_BASE_URL) {
  const cacheKey = `${baseUrl}/wp-content/uploads/wor-reader-cache/chapters/manifest/novel-${novelId}.json`;
  const cached = galaxyManifestCache.get(cacheKey);
  if (cached && Date.now() - cached.at < GALAXY_INDEX_TTL_MS) return cached.data;
  const response = await publicFetch(cacheKey, {
    headers: GALAXY_JSON_HEADERS(baseUrl),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`manifeste Galaxy Novels indisponible (${response.status})`);
  const data = await response.json();
  galaxyManifestCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

export function chaptersFromManifest(manifest, ctx = DEFAULT_CTX) {
  const tail = Array.isArray(manifest?.live_tail) ? manifest.live_tail : [];
  const latestUrl = manifest?.latest_url ? toGalaxyAbsoluteUrl(manifest.latest_url, ctx) : "";
  const latestNumber = manifest?.latest_number;
  const chapters = tail
    .map((chapter) => mapGalaxyChapterEntry(chapter, ctx))
    .filter(Boolean);
  if (latestUrl && latestNumber && !chapters.some((chapter) => chapter.url === latestUrl)) {
    const latest = mapGalaxyChapterEntry({
      url: latestUrl,
      number: latestNumber,
      label: String(latestNumber),
    }, ctx);
    if (latest) chapters.unshift(latest);
  }
  return normalizeGalaxyChapterList(chapters);
}

export function recentChaptersFromManifest(manifest, ctx = DEFAULT_CTX) {
  return recentChaptersFromList(chaptersFromManifest(manifest, ctx));
}

async function fetchGalaxyChapterIndex(novelId, rawIndexUrl = "", baseUrl = DEFAULT_BASE_URL) {
  const target = rawIndexUrl || `${baseUrl}/wp-content/uploads/wor-reader-cache/chapters/novel-${novelId}.json`;
  const url = new URL(decodeHtml(target));
  const allowedHost = new URL(baseUrl).hostname.replace(/^www\./i, "");
  if (url.protocol !== "https:" || !url.hostname.replace(/^www\./i, "").endsWith(allowedHost) || !/^\/wp-content\/uploads\/wor-reader-cache\/chapters\/novel-\d+\.json$/i.test(url.pathname)) {
    throw new Error("فهرس فصول Galaxy Novels غير صالح");
  }
  const cacheKey = url.toString();
  const cached = galaxyIndexCache.get(cacheKey);
  if (cached && Date.now() - cached.at < GALAXY_INDEX_TTL_MS) return cached.data;
  const response = await publicFetch(cacheKey, { headers: GALAXY_JSON_HEADERS(baseUrl), signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`فهرس فصول Galaxy Novels غير متاح (${response.status})`);
  const data = await response.json();
  galaxyIndexCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

async function fetchGalaxyChapterApi(rawApiUrl, baseUrl = DEFAULT_BASE_URL) {
  const url = new URL(rawApiUrl, baseUrl);
  const allowedHost = new URL(baseUrl).hostname.replace(/^www\./i, "");
  if (url.protocol !== "https:" || !url.hostname.replace(/^www\./i, "").endsWith(allowedHost) || !/^\/wp-json\/wor-reader-app\/v1\/chapters\/\d+\/?$/i.test(url.pathname)) {
    throw new Error("واجهة فصل Galaxy Novels غير صالحة");
  }
  const cacheKey = url.toString();
  const cached = galaxyChapterApiCache.get(cacheKey);
  if (cached && Date.now() - cached.at < GALAXY_CHAPTER_API_TTL_MS) return cached.data;
  const response = await publicFetch(cacheKey, { headers: GALAXY_JSON_HEADERS(baseUrl), signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`واجهة فصل Galaxy Novels غير متاحة (${response.status})`);
  const data = await response.json();
  galaxyChapterApiCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

async function enrichGalaxyCatalog(items, ctx = DEFAULT_CTX, { concurrency = 8 } = {}) {
  return enrichCatalogItems(items, {
    concurrency,
    needsEnrich: catalogNeedsRecentEnrich,
    enrichItem: async (item) => {
      if (!item.novelId) return [];
      const manifest = await fetchGalaxyChapterManifest(item.novelId, ctx.baseUrl);
      return recentChaptersFromManifest(manifest, ctx);
    },
  });
}

function buildGalaxyLibraryUrl(ctx, { page = 1, filterPath = "", queryParam = "", queryValue = "" } = {}) {
  if (queryParam === "author" && queryValue) {
    return `${ctx.baseUrl}/library/?q=${encodeURIComponent(queryValue)}&library_page=${page}`;
  }
  const filterTarget = new URL(filterPath || "/library/", ctx.baseUrl);
  if (queryParam && queryValue) filterTarget.searchParams.set(queryParam, queryValue);
  filterTarget.searchParams.set("library_page", String(page));
  return filterTarget.toString();
}

function galaxyLibraryHasMore(html, upstreamPage) {
  return new RegExp(`library_page=(?:${upstreamPage + 1})(?:[&\"'])`, "i").test(html);
}

export function galaxySearchMatches(item, query) {
  const hay = `${item?.title || ""} ${item?.id || ""} ${item?.altTitle || ""}`
    .toLowerCase()
    .replace(/[-_]+/g, " ");
  const needles = String(query || "").toLowerCase().replace(/[-_]+/g, " ").split(/\s+/).filter(Boolean);
  return needles.length > 0 && needles.every((needle) => hay.includes(needle));
}

async function searchGalaxyCatalog(ctx, fetchGalaxyHtml, query, page) {
  try {
    const html = await fetchGalaxyHtml(buildGalaxyLibraryUrl(ctx, {
      page,
      filterPath: "/library/",
      queryParam: "q",
      queryValue: query,
    }));
    const items = parseGalaxyCatalog(html, ctx);
    if (items.length) {
      await enrichGalaxyCatalog(items, ctx, { concurrency: 4 });
      return {
        items: items.slice(0, GALAXY_CATALOG_PAGE_SIZE),
        page,
        hasMore: galaxyLibraryHasMore(html, page) && items.length === GALAXY_CATALOG_PAGE_SIZE,
      };
    }
  } catch {
    // /library/?q= est souvent vide ou WAF ; on filtre le catalogue public.
  }

  const matches = [];
  let hasMoreUpstream = true;
  for (let libraryPage = 1; libraryPage <= 12 && hasMoreUpstream; libraryPage += 1) {
    const html = await fetchGalaxyHtml(buildGalaxyLibraryUrl(ctx, { page: libraryPage }));
    const pageItems = parseGalaxyCatalog(html, ctx);
    hasMoreUpstream = Boolean(pageItems.length) && galaxyLibraryHasMore(html, libraryPage);
    matches.push(...pageItems.filter((item) => galaxySearchMatches(item, query)));
    if (matches.length >= page * GALAXY_CATALOG_PAGE_SIZE) break;
  }
  const start = (page - 1) * GALAXY_CATALOG_PAGE_SIZE;
  const items = matches.slice(start, start + GALAXY_CATALOG_PAGE_SIZE);
  await enrichGalaxyCatalog(items, ctx, { concurrency: 4 });
  return {
    items,
    page,
    hasMore: matches.length > start + items.length || (hasMoreUpstream && items.length === GALAXY_CATALOG_PAGE_SIZE),
  };
}

export async function fetchGalaxyCatalogPage(ctx, fetchGalaxyHtml, {
  page = 1,
  filterPath = "",
  queryParam = "",
  queryValue = "",
  enrich = true,
} = {}) {
  const offset = (page - 1) * GALAXY_CATALOG_PAGE_SIZE;
  const upstreamPage = Math.floor(offset / UPSTREAM_LIBRARY_PAGE_SIZE) + 1;
  const start = offset % UPSTREAM_LIBRARY_PAGE_SIZE;
  const needsSpill = start + GALAXY_CATALOG_PAGE_SIZE > UPSTREAM_LIBRARY_PAGE_SIZE;

  const fetchUpstream = async (upstream) => {
    const target = buildGalaxyLibraryUrl(ctx, { page: upstream, filterPath, queryParam, queryValue });
    const html = await fetchGalaxyHtml(target);
    return { html, items: parseGalaxyCatalog(html, ctx) };
  };

  const [first, second] = await Promise.all([
    fetchUpstream(upstreamPage),
    needsSpill ? fetchUpstream(upstreamPage + 1).catch(() => ({ html: "", items: [] })) : Promise.resolve({ html: "", items: [] }),
  ]);

  const pool = [...first.items];
  if (needsSpill && second.items.length) pool.push(...second.items);

  let items = pool.slice(start, start + GALAXY_CATALOG_PAGE_SIZE);
  let nextUpstream = upstreamPage + (needsSpill ? 2 : 1);
  let lastHtml = needsSpill ? second.html : first.html;
  let hasMoreUpstream = galaxyLibraryHasMore(lastHtml || first.html, needsSpill ? upstreamPage + 1 : upstreamPage);

  while (items.length < GALAXY_CATALOG_PAGE_SIZE && hasMoreUpstream && nextUpstream <= upstreamPage + 4) {
    const extra = await fetchUpstream(nextUpstream).catch(() => ({ html: "", items: [] }));
    if (!extra.items.length) break;
    pool.push(...extra.items);
    items = pool.slice(start, start + GALAXY_CATALOG_PAGE_SIZE);
    lastHtml = extra.html;
    hasMoreUpstream = galaxyLibraryHasMore(extra.html, nextUpstream);
    nextUpstream += 1;
  }

  if (enrich) {
    const pendingNovelIds = [...new Set(
      items.filter((item) => catalogNeedsRecentEnrich(item)).map((item) => item.novelId).filter(Boolean),
    )];
    if (pendingNovelIds.length) {
      await mapWithConcurrency(
        pendingNovelIds,
        12,
        (novelId) => fetchGalaxyChapterManifest(novelId, ctx.baseUrl).catch(() => null),
      );
    }

    await enrichGalaxyCatalog(items, ctx, { concurrency: 8 });
  }

  return {
    items,
    page,
    hasMore: items.length === GALAXY_CATALOG_PAGE_SIZE && hasMoreUpstream,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchGalaxyTaxonomyFilters(ctx, fetchGalaxyHtml) {
  const cacheKey = ctx.baseUrl;
  const cached = galaxyTaxonomyFiltersCache.get(cacheKey);
  if (cached && Date.now() - cached.at < GALAXY_FILTERS_CACHE_TTL_MS) return cached.data;
  const html = await fetchGalaxyHtml(`${ctx.baseUrl}/library/`);
  const data = mergeFilterGroups([parseTaxonomyFilterLinks(html, ctx.baseUrl, [ctx.apex, ctx.hostname])]);
  galaxyTaxonomyFiltersCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

async function parseGalaxyDetails(html, url, ctx = DEFAULT_CTX) {
  const pageTag = html.match(/<article[^>]*class="[^"]*wor-single-novel-page[^"]*"[^>]*>/i)?.[0] ?? "";
  const novelId = Number(pageTag.match(/data-novel-id="(\d+)"/i)?.[1] ?? 0);
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
  let author = parseGalaxyAuthorFromHtml(html);
  let altTitle = "";
  const indexUrl = decodeHtml(html.match(/data-index-url="([^"]+)"/i)?.[1] ?? "");
  let chapters = [];

  if (novelId) {
    const [apiSettled, indexSettled, manifestSettled] = await Promise.allSettled([
      fetchGalaxyNovelApi(novelId, ctx.baseUrl),
      indexUrl || novelId ? fetchGalaxyChapterIndex(novelId, indexUrl, ctx.baseUrl) : Promise.reject(new Error("no index")),
      fetchGalaxyChapterManifest(novelId, ctx.baseUrl),
    ]);

    if (apiSettled.status === "fulfilled") {
      author = textOnly(apiSettled.value.author || author);
      altTitle = textOnly(apiSettled.value.original_title || "");
    }
    if (indexSettled.status === "fulfilled") {
      chapters = mapGalaxyChapters(indexSettled.value, ctx);
    } else if (manifestSettled.status === "fulfilled") {
      chapters = chaptersFromManifest(manifestSettled.value, ctx);
    }
  }

  const title = textOnly(html.match(/<div[^>]*class="[^"]*wor-single-hero__body[^"]*"[^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const coverTag = html.match(/<div[^>]*class="[^"]*wor-single-hero__cover[^"]*"[^>]*>[\s\S]*?<img[^>]*class="[^"]*wor-cover-img[^"]*"[^>]*>/i)?.[0] ?? "";
  const cover = decodeHtml(coverTag.match(/data-src="([^"]+)"/i)?.[1] ?? html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ?? "");
  const summary = textOnly(html.match(/<div[^>]*class="[^"]*wor-single-summary__text[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? "");

  if (!chapters.length) {
    const seen = new Set();
    for (const match of html.matchAll(/<a[^>]*class="[^"]*wor-novel-chapter-item__num[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      if (seen.has(match[1])) continue;
      seen.add(match[1]);
      const chapterUrl = toGalaxyAbsoluteUrl(match[1], ctx);
      const number = textOnly(match[2]) || extractChapterNumberFromUrl(chapterUrl);
      chapters.push({
        url: chapterUrl,
        name: textOnly(match[2]) || String(number),
        number: String(number),
        date: "",
        locked: false,
      });
    }
    chapters = normalizeGalaxyChapterList(chapters);
  }

  if (author) {
    chapters = chapters.map((chapter) => ({ ...chapter, author }));
  }
  const taxonomies = parseDetailTaxonomies(html, ctx.baseUrl);
  return enrichSourceDetails({
    id: slug,
    novelId,
    title,
    altTitle,
    author,
    cover,
    summary,
    url,
    source: "Galaxy Novels",
    sourceId: "galaxynovels",
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    ...taxonomies,
    chapters,
  }, { html, parser: "galaxy" });
}

function galaxyCoverFromApi(cover) {
  if (!cover) return "";
  if (typeof cover === "string") return decodeHtml(cover);
  return decodeHtml(cover.large || cover.medium || cover.thumbnail || "");
}

export function chaptersFromGalaxyCount(count, slug, ctx = DEFAULT_CTX) {
  const total = Math.max(0, Math.min(Number(count) || 0, 5000));
  if (!slug || !total) return [];
  const chapters = [];
  for (let number = total; number >= 1; number -= 1) {
    const chapterUrl = toGalaxyAbsoluteUrl(`/novel/${slug}/chapter-${number}/`, ctx);
    chapters.push({
      url: chapterUrl,
      name: String(number),
      number: String(number),
      date: "",
      locked: false,
    });
  }
  return normalizeGalaxyChapterList(chapters);
}

async function findGalaxyNovelBySlug(slug, fetchGalaxyHtml, ctx) {
  const wanted = String(slug || "").toLowerCase();
  if (!wanted) return null;
  for (let page = 1; page <= 16; page += 1) {
    const html = await fetchGalaxyHtml(buildGalaxyLibraryUrl(ctx, { page }));
    const match = parseGalaxyCatalog(html, ctx).find((item) => String(item.id || "").toLowerCase() === wanted);
    if (match?.novelId) return match;
    if (!galaxyLibraryHasMore(html, page)) break;
  }
  return null;
}

async function detailsFromGalaxyNovelId(novelId, url, ctx) {
  const api = await fetchGalaxyNovelApi(novelId, ctx.baseUrl);
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
  let chapters = [];
  const [indexSettled, manifestSettled] = await Promise.allSettled([
    fetchGalaxyChapterIndex(novelId, "", ctx.baseUrl),
    fetchGalaxyChapterManifest(novelId, ctx.baseUrl),
  ]);
  if (indexSettled.status === "fulfilled") chapters = mapGalaxyChapters(indexSettled.value, ctx);
  else if (manifestSettled.status === "fulfilled") chapters = chaptersFromManifest(manifestSettled.value, ctx);
  if (!chapters.length) chapters = chaptersFromGalaxyCount(api.chapters_count, slug, ctx);

  const author = textOnly(api.author || api.translator || "");
  if (author) {
    chapters = chapters.map((chapter) => ({ ...chapter, author }));
  }
  const genres = Array.isArray(api.genres)
    ? api.genres.map((genre) => textOnly(genre?.name || genre)).filter(Boolean)
    : [];
  const cover = galaxyCoverFromApi(api.cover);
  return enrichSourceDetails({
    id: slug,
    novelId,
    title: textOnly(api.title || ""),
    altTitle: textOnly(api.original_title || ""),
    author,
    cover: cover ? toGalaxyAbsoluteUrl(cover, ctx) : "",
    summary: textOnly(api.summary || ""),
    url,
    source: "Galaxy Novels",
    sourceId: "galaxynovels",
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    status: textOnly(api.status?.label || api.status?.key || ""),
    publicationStatus: api.status?.key || undefined,
    publicationStatusLabel: textOnly(api.status?.label || ""),
    categories: genres,
    genres,
    chapters,
  }, { parser: "galaxy" });
}

export async function loadGalaxyDetails(target, fetchGalaxyHtml, ctx, { novelId = 0 } = {}) {
  const resolvedId = Number(novelId) || 0;
  if (resolvedId > 0) {
    try {
      return await detailsFromGalaxyNovelId(resolvedId, target, ctx);
    } catch {
      // HTML / Flare ci-dessous.
    }
  }

  try {
    const html = await fetchGalaxyHtml(target);
    if (galaxyPageHtmlLooksValid(html, target)) {
      return parseGalaxyDetails(html, target, ctx);
    }
  } catch {
    // /novel/{slug} est souvent bloqué par le WAF Cloudflare.
  }

  const slug = new URL(target).pathname.split("/").filter(Boolean).pop() || "";
  const match = await findGalaxyNovelBySlug(slug, fetchGalaxyHtml, ctx);
  if (match?.novelId) {
    return detailsFromGalaxyNovelId(match.novelId, target, ctx);
  }
  throw new Error("حماية Galaxy Novels تمنع الاتصال (Cloudflare)");
}

const GALAXY_CHAPTER_BODY = /<div[^>]*(?:class="[^"]*(?:wor-reader-text-surface|wor-reading-page__content)[^"]*"|itemprop="text"|data-wor-reader-text)[^>]*>/i;
const GALAXY_CHAPTER_PLACEHOLDER = /تفعيل JavaScript|فعّل JavaScript|يرجى تفعيل/i;

export function extractGalaxyParagraphs(html) {
  const paragraphs = [...String(html || "").matchAll(/<(?:p|h[2-6]|blockquote)[^>]*>([\s\S]*?)<\/(?:p|h[2-6]|blockquote)>/gi)]
    .map((match) => textOnly(match[1]))
    .filter((text) => text && !GALAXY_CHAPTER_PLACEHOLDER.test(text));
  return filterNovelParagraphs(paragraphs);
}

export function parseGalaxyChapter(html, url) {
  const articleTag = html.match(/<article[^>]*class="[^"]*wor-reading-page[^"]*"[^>]*>/i)?.[0] ?? "";
  const title = decodeHtml(articleTag.match(/data-chapter-title="([^"]+)"/i)?.[1] ?? html.match(/<h1[^>]*itemprop="headline"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const contentStart = html.search(GALAXY_CHAPTER_BODY);
  const contentEnd = contentStart >= 0 ? html.indexOf("</article>", contentStart) : -1;
  const block = contentStart >= 0 ? html.slice(contentStart, contentEnd >= 0 ? contentEnd : html.length) : html;
  const paragraphs = extractGalaxyParagraphs(block);
  return { title: textOnly(title), url, kind: "novel", paragraphs, pages: [] };
}

export function extractGalaxyChapterApiFromHtml(html = "", baseUrl = DEFAULT_BASE_URL) {
  const raw = html.match(/data-content-api=["']([^"']+)["']/i)?.[1]
    ?? html.match(/data-chapter-api=["']([^"']+)["']/i)?.[1]
    ?? "";
  if (!raw) return "";
  try {
    return toGalaxyAbsoluteUrl(raw, createHostContext(baseUrl));
  } catch {
    return "";
  }
}

export async function resolveGalaxyChapter(target, apiUrl, fetchGalaxyHtml, ctx = DEFAULT_CTX) {
  if (apiUrl) {
    try {
      const parsed = parseGalaxyChapterApi(await fetchGalaxyChapterApi(apiUrl, ctx.baseUrl), target, ctx);
      if (parsed.paragraphs.length) return parsed;
    } catch {
      // Passe au HTML public.
    }
  }

  const html = await fetchGalaxyHtml(target);
  const inlineApi = extractGalaxyChapterApiFromHtml(html, ctx.baseUrl);
  if (inlineApi && inlineApi !== apiUrl) {
    try {
      const parsed = parseGalaxyChapterApi(await fetchGalaxyChapterApi(inlineApi, ctx.baseUrl), target, ctx);
      if (parsed.paragraphs.length) return parsed;
    } catch {
      // Passe au HTML rendu.
    }
  }

  const parsed = parseGalaxyChapter(html, target);
  if (parsed.paragraphs.length) return parsed;
  throw new Error("تعذر استخراج نص الفصل");
}

export function parseGalaxyChapterApi(payload, fallbackUrl, ctx = DEFAULT_CTX) {
  const chapter = payload?.data || payload || {};
  const html = chapter.content_html || chapter.content || chapter.html || "";
  const paragraphs = extractGalaxyParagraphs(html);
  const url = chapter.url ? toGalaxyAbsoluteUrl(chapter.url, ctx) : fallbackUrl;
  return { title: textOnly(chapter.display_title || chapter.title || chapter.label || ""), url, kind: "novel", paragraphs, pages: [] };
}

export async function handleGalaxyRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: "Galaxy Novels" });
  const fetchGalaxyHtml = createFetcher(ctx.baseUrl);

  if (requestUrl.pathname.endsWith("/image")) return await proxyGalaxyImage(requestUrl.searchParams.get("url") ?? "", ctx);
  if (requestUrl.pathname.endsWith("/filters")) {
    const taxonomy = await fetchGalaxyTaxonomyFilters(ctx, fetchGalaxyHtml);
    const authors = await buildGalaxyAuthorFilters(fetchGalaxyHtml, ctx.baseUrl, GALAXY_AUTHOR_FILTER_QUICK_PAGES);
    warmGalaxyAuthorFilters(fetchGalaxyHtml, ctx.baseUrl);
    return responseJson(200, {
      ...taxonomy,
      authors,
      fetchedAt: new Date().toISOString(),
    });
  }
  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const filterPath = requestUrl.searchParams.get("filterPath")?.trim() ?? "";
    const queryParam = requestUrl.searchParams.get("queryParam")?.trim() ?? "";
    const queryValue = requestUrl.searchParams.get("queryValue")?.trim() ?? "";
    if (filterPath && (!/^\/[\p{L}\p{N}/+_.%-]+\/?$/u.test(filterPath) || filterPath.includes(".."))) throw new Error("مسار فلتر Galaxy Novels غير صالح");
    if (queryParam && !new Set(["genres", "genre", "category", "tags", "tag", "author"]).has(queryParam)) throw new Error("فلتر Galaxy Novels غير صالح");
    const enrich = catalogEnrichFromSearchParams(requestUrl.searchParams);
    return responseJson(200, await fetchGalaxyCatalogPage(ctx, fetchGalaxyHtml, { page, filterPath, queryParam, queryValue, enrich }));
  }
  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    return responseJson(200, await searchGalaxyCatalog(ctx, fetchGalaxyHtml, query, page));
  }
  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertGalaxyUrl(requestUrl.searchParams.get("url") ?? "", false, ctx);
    const novelId = Number(requestUrl.searchParams.get("novelId") || 0);
    return responseJson(200, await loadGalaxyDetails(target, fetchGalaxyHtml, ctx, { novelId }));
  }
  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertGalaxyUrl(requestUrl.searchParams.get("url") ?? "", true, ctx);
    const apiUrl = requestUrl.searchParams.get("api") ?? "";
    return responseJson(200, await resolveGalaxyChapter(target, apiUrl, fetchGalaxyHtml, ctx));
  }
  return responseJson(404, { error: "Route Galaxy Novels inconnue" });
}
