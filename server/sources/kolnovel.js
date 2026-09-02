import { decodeHtml, parseDetailTaxonomies, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/responseJson.js";
import {
  applyRecentChapterFields,
  catalogNeedsRecentEnrich,
  enrichCatalogItems,
  recentChaptersFromList,
} from "../lib/catalogChapters.js";
import { normalizeChapterList } from "../lib/chapterOrdering.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import {
  parseParadiseChapter,
  parseParadiseFilters,
  paradiseCatalogHtmlLooksValid,
  resolveParadiseTitles,
  catalogHasMorePages,
  extractEplisterListBlocks,
} from "./novelsparadise.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";
import { configureSourceNativeFetch } from "../lib/nativeFetchBridge.js";

const DEFAULT_BASE_URL = "https://kolnovel.com";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
const SOURCE_NAME = "Kol Novel";
const SOURCE_ID = "kolnovel";
const CHAPTER_SLUG_PREFIX = "shaag24";
const CHAPTER_SLUG_MARKER = "z435ggye-";
/** Même densité que Realm Novel / Cenele. */
export const KOLNOVEL_CATALOG_PAGE_SIZE = 24;
const UPSTREAM_CATALOG_PAGE_SIZE = 20;
const KOLNOVEL_FILTERS_CACHE_TTL_MS = 30 * 60_000;
const KOLNOVEL_SERIES_CHAPTERS_CACHE_TTL_MS = 5 * 60_000;
const kolnovelFiltersCache = new Map();
const kolnovelSeriesChaptersCache = new Map();

export function configureKolnovelNativeFetch(options) {
  configureSourceNativeFetch(options);
}

function createFetcher(baseUrl = DEFAULT_BASE_URL) {
  return createCachedHtmlFetcher({
    ttlMs: 3 * 60_000,
    timeoutMs: 35_000,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ar,en-US;q=0.9,en;q=0.8",
      referer: `${baseUrl}/series/`,
      "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "upgrade-insecure-requests": "1",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    getVariants: (url) => [url],
    buildError: (lastStatus) => (lastStatus === 403
      ? "حماية Kol Novel تمنع الاتصال (Cloudflare)"
      : `Kol Novel a répondu ${lastStatus}`),
    preferFlareSolverr: false,
  });
}

function assertKolnovelHost(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("المصدر غير مسموح");
  }
  url.hostname = ctx.apex;
  url.hash = "";
  return url;
}

function assertKolnovelImageUrl(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("رابط الصورة غير مسموح");
  }
  return url.toString();
}

export function slugFromPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "series" && parts[1]) return parts[1];
  return parts[0] || "";
}

export function seriesSlugFromSlug(slug) {
  return slug.replace(/-\d+$/, "");
}

export function buildSeriesUrl(seriesSlug, baseUrl = DEFAULT_BASE_URL) {
  return `${baseUrl}/series/${seriesSlug}/`;
}

export function normalizeSeriesUrl(rawUrl) {
  const url = assertKolnovelHost(rawUrl);
  const slug = slugFromPath(url.pathname);
  if (!slug || slug === "list-mode") throw new Error("رابط Kol Novel غير صالح");
  return buildSeriesUrl(seriesSlugFromSlug(slug));
}

export function normalizeChapterUrl(rawUrl) {
  const url = assertKolnovelHost(rawUrl);
  const pathname = url.pathname.replace(/\/pdf\/?$/i, "");
  const slug = slugFromPath(pathname);
  if (!slug || slug === "series" || !/^shaag24/i.test(slug)) {
    throw new Error("رابط فصل Kol Novel غير صالح");
  }
  return `${DEFAULT_BASE_URL}/${slug}/`;
}

function isKolnovelChapterSlug(slug, seriesSlug) {
  const lower = slug.toLowerCase();
  const series = seriesSlug.toLowerCase();
  return lower.startsWith(`${CHAPTER_SLUG_PREFIX}${series}${CHAPTER_SLUG_MARKER}`)
    && new RegExp(`${CHAPTER_SLUG_MARKER}\\d+$`, "i").test(lower);
}

function parseImageUrl(tag = "") {
  const dataLazy = tag.match(/data-lazy-src=["']([^"']+)["']/i)?.[1];
  const dataSrc = tag.match(/data-src=["']([^"']+)["']/i)?.[1];
  const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
  return decodeHtml(dataLazy || dataSrc || src || "");
}

function parseCatalogArabicTitleFromExcerpt(article = "") {
  const excerpt = textOnly(article.match(/class="[^"]*contexcerpt[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
  const matches = [...excerpt.matchAll(/رواية\s+((?:[\u0600-\u06FF][\u0600-\u06FF\s'’\-:،؛!؟.]*?))\s+مترجمة/giu)];
  if (!matches.length) return "";
  return matches.sort((a, b) => b[1].length - a[1].length)[0][1].trim();
}

function parseArticleTitleAndHref(article) {
  const headline = article.match(/<h2[^>]*itemprop=["']headline["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (headline) return { href: decodeHtml(headline[1]), title: headline[2] };
  const forward = article.match(/<a\b[^>]*title=["']([^"']+)["'][^>]*href=["']([^"']+)["']/i);
  if (forward) return { title: forward[1], href: forward[2] };
  const reverse = article.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/i);
  if (reverse) return { title: reverse[2], href: reverse[1] };
  return null;
}

function parseCatalogLatestChapterNumber(article = "") {
  for (const match of article.matchAll(/class="[^"]*nchapter[^"]*"[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = textOnly(match[2]);
    const number = extractKolnovelChapterNumber(label, match[1]);
    if (number) return number;
  }
  return "";
}

function parseCatalogGenres(article = "") {
  const genres = [];
  const seen = new Set();
  for (const match of article.matchAll(/<span[^>]*class="[^"]*mdgenre[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)) {
    for (const label of match[1].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)) {
      const name = textOnly(label[1]).replace(/^#\s*/, "").trim();
      const key = name.toLocaleLowerCase("ar");
      if (!name || seen.has(key)) continue;
      seen.add(key);
      genres.push(name);
    }
  }
  return genres.slice(0, 12);
}

export function extractKolnovelChapterNumber(primaryText, secondaryText = "", fallback = "") {
  const primary = textOnly(primaryText);
  const secondary = textOnly(secondaryText);

  const fromPrimaryChapter = primary.match(/(?:الفصل|فصل|chapter)\s*[.:#-]?\s*(\d+(?:\.\d+)?)/i);
  if (fromPrimaryChapter) return fromPrimaryChapter[1];

  const fromSecondaryChapter = secondary.match(/(?:الفصل|فصل|chapter)\s*[.:#-]?\s*(\d+(?:\.\d+)?)/i);
  if (fromSecondaryChapter) return fromSecondaryChapter[1];

  const primaryNumbers = [...primary.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => match[1]);
  if (primaryNumbers.length >= 2 && /(?:موسم|season)/i.test(primary)) return primaryNumbers.at(-1);
  if (primaryNumbers.length === 1) return primaryNumbers[0];

  const parens = secondary.match(/\((\d+(?:\.\d+)?)\)\s*$/);
  if (parens) return parens[1];

  const secondaryNumber = secondary.match(/(\d+(?:\.\d+)?)/);
  if (secondaryNumber) return secondaryNumber[1];

  return fallback;
}

function buildKolnovelCatalogUrl(page, { status = "", order = "latest", genre = "", tag = "" } = {}, baseUrl = DEFAULT_BASE_URL) {
  const query = new URL(`${baseUrl}/series/`);
  query.searchParams.set("page", String(page));
  query.searchParams.set("status", status);
  query.searchParams.set("order", order);
  if (genre) query.searchParams.append("genre[]", genre);
  if (tag) query.searchParams.append("type[]", tag);
  return query.toString();
}

function assertKolnovelFilterSlug(value, label) {
  const slug = value?.trim() ?? "";
  if (!slug) return "";
  if (!/^[\p{L}\p{N}+_.-]+$/u.test(slug)) throw new Error(`${label} Kol Novel غير صالح`);
  return slug;
}

function mapCatalogItem(rawTitle, href, cover, article = "") {
  const pathname = new URL(href, DEFAULT_BASE_URL).pathname;
  const slug = seriesSlugFromSlug(decodeURIComponent(slugFromPath(pathname)));
  const alter = article.match(/<span class="alter">([\s\S]*?)<\/span>/i)?.[1] ?? "";
  const excerptTitle = parseCatalogArabicTitleFromExcerpt(article);
  const { title, altTitle } = resolveParadiseTitles(rawTitle, alter || excerptTitle);
  const genres = parseCatalogGenres(article);
  const latestChapterNumber = parseCatalogLatestChapterNumber(article);
  return {
    id: slug,
    title,
    altTitle,
    url: buildSeriesUrl(slug),
    cover: decodeHtml(cover),
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    categories: genres,
    genres,
    latestChapter: latestChapterNumber || "—",
    latestChapterUrl: null,
    recentChapters: [],
  };
}

export function parseKolnovelCatalog(html) {
  const results = [];
  const seen = new Set();
  for (const block of html.matchAll(/<article\b[\s\S]*?<\/article>/gi)) {
    const article = block[0];
    if (!/maindet|ts-post-image|nchapter|contexcerpt|itemprop=["']headline["']/i.test(article)) continue;
    const link = parseArticleTitleAndHref(article);
    if (!link?.href) continue;
    const imageTag = article.match(/<img\b[^>]*class="[^"]*ts-post-image[^"]*"[^>]*>/i)?.[0]
      ?? article.match(/<img\b[^>]*>/i)?.[0]
      ?? "";
    const item = mapCatalogItem(link.title, link.href, parseImageUrl(imageTag), article);
    if (!item.title || !item.url.includes("/series/") || seen.has(item.id)) continue;
    seen.add(item.id);
    results.push(item);
  }
  return results;
}

export function parseKolnovelChapters(html, seriesUrl) {
  const chapters = [];
  const seen = new Set();
  const seriesSlug = seriesSlugFromSlug(slugFromPath(new URL(seriesUrl, DEFAULT_BASE_URL).pathname));
  const eplisterBlocks = extractEplisterListBlocks(html);
  if (!eplisterBlocks.length) return chapters;

  for (const eplisterBlock of eplisterBlocks) {
    for (const match of eplisterBlock.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const block = match[1];
    const link = block.match(/<a\b[^>]*href=["']([^"']+)["']/i);
    if (!link) continue;
    const chapterUrl = decodeHtml(link[1]);
    if (/\/pdf\/?$/i.test(chapterUrl)) continue;
    const chapterSlug = slugFromPath(new URL(chapterUrl, DEFAULT_BASE_URL).pathname);
    if (!isKolnovelChapterSlug(chapterSlug, seriesSlug)) continue;
    const normalizedUrl = new URL(chapterUrl, DEFAULT_BASE_URL).toString();
    if (seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);
    const eplNum = block.match(/class="[^"]*epl-num[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "";
    const eplTitle = block.match(/class="[^"]*epl-title[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "";
    const date = textOnly(block.match(/class="[^"]*epl-date[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
    const locked = /fa-lock|🔒|مدفوع/i.test(block);
    const number = extractKolnovelChapterNumber(eplNum, eplTitle, "");
    if (!number) continue;
    const name = textOnly(eplTitle) || textOnly(eplNum) || number;
    chapters.push({
      url: normalizedUrl,
      name: locked ? `🔒 ${name}` : name,
      number,
      date,
      locked,
    });
    }
  }
  return chapters;
}

function parseKolnovelDetails(html, url) {
  const primaryTitle = textOnly(
    html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]?.split(" - ")?.[0]
    ?? "",
  );
  const alternateTitle = textOnly(html.match(/<span class="alter">([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const { title, altTitle } = resolveParadiseTitles(primaryTitle, alternateTitle);
  const coverTag = html.match(/<(?:div[^>]*class="[^"]*(?:thumb|thumbook)[^"]*"[^>]*>[\s\S]*?)<img\b[^>]*>/i)?.[0]
    ?? html.match(/<img\b[^>]*class="[^"]*ts-post-image[^"]*"[^>]*>/i)?.[0]
    ?? "";
  const cover = parseImageUrl(coverTag)
    || decodeHtml(html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? "");
  const summary = textOnly(
    html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
    ?? html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]
    ?? "",
  );
  const chapters = normalizeChapterList(parseKolnovelChapters(html, url));
  const taxonomies = parseDetailTaxonomies(html, DEFAULT_BASE_URL);
  const seriesSlug = seriesSlugFromSlug(slugFromPath(new URL(url).pathname));
  const latest = chapters[0];
  return enrichSourceDetails({
    id: seriesSlug,
    title,
    altTitle,
    cover,
    summary,
    url,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    ...taxonomies,
    chapters,
    latestChapter: latest?.number ?? "—",
    latestChapterUrl: latest?.url ?? null,
    recentChapters: chapters.slice(0, 2),
  });
}

function appendUniqueCatalogItems(pool, seen, items = []) {
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    pool.push(item);
  }
}

async function enrichKolnovelCatalog(items, fetchHtml) {
  return enrichCatalogItems(items, {
    concurrency: 4,
    needsEnrich: (item) => catalogNeedsRecentEnrich(item, 1),
    enrichItem: async (item) => {
      const cached = kolnovelSeriesChaptersCache.get(item.url);
      if (cached && Date.now() - cached.at < KOLNOVEL_SERIES_CHAPTERS_CACHE_TTL_MS) {
        return cached.chapters;
      }
      const html = await fetchHtml(item.url);
      const chapters = recentChaptersFromList(normalizeChapterList(parseKolnovelChapters(html, item.url)));
      kolnovelSeriesChaptersCache.set(item.url, { at: Date.now(), chapters });
      return chapters;
    },
  });
}

export async function fetchKolnovelCatalogPage(ctx, fetchHtml, {
  page = 1,
  order = "latest",
  genre = "",
  tag = "",
  status = "",
} = {}) {
  const offset = (page - 1) * KOLNOVEL_CATALOG_PAGE_SIZE;
  const upstreamPage = Math.floor(offset / UPSTREAM_CATALOG_PAGE_SIZE) + 1;
  const start = offset % UPSTREAM_CATALOG_PAGE_SIZE;
  const needsSpill = start + KOLNOVEL_CATALOG_PAGE_SIZE > UPSTREAM_CATALOG_PAGE_SIZE;

  const fetchUpstream = async (upstream) => {
    const target = buildKolnovelCatalogUrl(upstream, { status, order, genre, tag }, ctx.baseUrl);
    const html = await fetchHtml(target);
    assertKolnovelCatalogHtml(target, html, parseKolnovelCatalog(html));
    return { html, items: parseKolnovelCatalog(html) };
  };

  const [first, second] = await Promise.all([
    fetchUpstream(upstreamPage),
    needsSpill
      ? fetchUpstream(upstreamPage + 1).catch(() => ({ html: "", items: [] }))
      : Promise.resolve({ html: "", items: [] }),
  ]);

  const seen = new Set();
  const pool = [];
  appendUniqueCatalogItems(pool, seen, first.items);
  if (needsSpill) appendUniqueCatalogItems(pool, seen, second.items);

  let items = pool.slice(start, start + KOLNOVEL_CATALOG_PAGE_SIZE);
  let nextUpstream = upstreamPage + (needsSpill ? 2 : 1);
  let lastHtml = needsSpill ? second.html : first.html;
  let hasMoreUpstream = catalogHasMorePages(lastHtml || first.html, needsSpill ? upstreamPage + 1 : upstreamPage);

  while (items.length < KOLNOVEL_CATALOG_PAGE_SIZE && hasMoreUpstream && nextUpstream <= upstreamPage + 4) {
    const extra = await fetchUpstream(nextUpstream).catch(() => ({ html: "", items: [] }));
    if (!extra.items.length) break;
    const before = pool.length;
    appendUniqueCatalogItems(pool, seen, extra.items);
    if (pool.length === before) break;
    items = pool.slice(start, start + KOLNOVEL_CATALOG_PAGE_SIZE);
    lastHtml = extra.html;
    hasMoreUpstream = catalogHasMorePages(extra.html, nextUpstream);
    nextUpstream += 1;
  }

  await enrichKolnovelCatalog(items, fetchHtml);

  return {
    items,
    page,
    genre,
    tag,
    hasMore: items.length === KOLNOVEL_CATALOG_PAGE_SIZE && hasMoreUpstream,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchKolnovelFilters(fetchHtml, baseUrl) {
  const cacheKey = baseUrl;
  const cached = kolnovelFiltersCache.get(cacheKey);
  if (cached && Date.now() - cached.at < KOLNOVEL_FILTERS_CACHE_TTL_MS) return cached.data;
  const html = await fetchHtml(buildKolnovelCatalogUrl(1, {}, baseUrl));
  const data = parseParadiseFilters(html);
  kolnovelFiltersCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

function isKolnovelCatalogUrl(url = "") {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/series/" || parsed.pathname.startsWith("/series/");
  } catch {
    return false;
  }
}

function assertKolnovelCatalogHtml(url, html, items = []) {
  if (!isKolnovelCatalogUrl(url) || items.length > 0 || paradiseCatalogHtmlLooksValid(html)) return;
  throw new Error("حماية Kol Novel تمنع الاتصال (Cloudflare)");
}

export async function handleKolnovelRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: SOURCE_NAME });
  const remoteFetcher = createFetcher(ctx.baseUrl);
  const fetchKolnovelHtmlBound = remoteFetcher;

  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(assertKolnovelImageUrl(requestUrl.searchParams.get("url") ?? "", ctx), `${ctx.baseUrl}/`, SOURCE_NAME);
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const filters = await fetchKolnovelFilters(fetchKolnovelHtmlBound, ctx.baseUrl);
    return responseJson(200, { ...filters, fetchedAt: new Date().toISOString() });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const order = requestUrl.searchParams.get("order")?.trim() || "latest";
    const genre = assertKolnovelFilterSlug(requestUrl.searchParams.get("genre"), "تصنيف");
    const tag = assertKolnovelFilterSlug(requestUrl.searchParams.get("tag"), "وسم");
    const payload = await fetchKolnovelCatalogPage(ctx, fetchKolnovelHtmlBound, {
      page,
      order,
      genre,
      tag,
      status: requestUrl.searchParams.get("status") ?? "",
    });
    return responseJson(200, payload);
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = assertKolnovelFilterSlug(requestUrl.searchParams.get("genre"), "تصنيف");
    const tag = assertKolnovelFilterSlug(requestUrl.searchParams.get("tag"), "وسم");
    const target = new URL(`${ctx.baseUrl}/series/`);
    target.searchParams.set("page", String(page));
    target.searchParams.set("s", query);
    if (genre) target.searchParams.append("genre[]", genre);
    if (tag) target.searchParams.append("type[]", tag);
    const html = await fetchKolnovelHtmlBound(target.toString());
    let items = parseKolnovelCatalog(html);
    assertKolnovelCatalogHtml(target.toString(), html, items);
    items = items.slice(0, KOLNOVEL_CATALOG_PAGE_SIZE);
    await enrichKolnovelCatalog(items, fetchKolnovelHtmlBound);
    return responseJson(200, {
      items,
      page,
      hasMore: catalogHasMorePages(html, page) && items.length === KOLNOVEL_CATALOG_PAGE_SIZE,
    });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = normalizeSeriesUrl(requestUrl.searchParams.get("url") ?? "");
    const html = await fetchKolnovelHtmlBound(target);
    return responseJson(200, parseKolnovelDetails(html, target));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = normalizeChapterUrl(requestUrl.searchParams.get("url") ?? "");
    const html = await remoteFetcher(target);
    return responseJson(200, parseParadiseChapter(html, target));
  }

  return responseJson(404, { error: "Route Kol Novel inconnue" });
}
