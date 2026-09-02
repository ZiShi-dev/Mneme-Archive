import { decodeHtml, parseDetailTaxonomies, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/responseJson.js";
import {
  applyRecentChapterFields,
  catalogNeedsRecentEnrich,
  enrichCatalogItems,
  normalizeRecentChapters,
  recentChaptersFromList,
} from "../lib/catalogChapters.js";
import { normalizeChapterList, extractChapterNumberFromUrl } from "../lib/chapterOrdering.js";
import { enrichChapterDates } from "../lib/chapterDates.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";
import { isNovelBoilerplateParagraph } from "../lib/novelChapterText.js";
import { configureSourceNativeFetch } from "../lib/nativeFetchBridge.js";
import { isCloudflareChallengeHtml } from "../lib/cloudflareDetect.js";

const DEFAULT_BASE_URL = "https://novelsparadise.site";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
const SOURCE_NAME = "Novels Paradise";
const SOURCE_ID = "novelsparadise";
/** Même densité que Realm Novel / MangaLik / Galaxy Novels. */
export const PARADISE_CATALOG_PAGE_SIZE = 24;
const UPSTREAM_CATALOG_PAGE_SIZE = 20;
const PARADISE_FILTERS_CACHE_TTL_MS = 30 * 60_000;
const PARADISE_SERIES_CHAPTERS_CACHE_TTL_MS = 5 * 60_000;
const paradiseFiltersCache = new Map();
const paradiseSeriesChaptersCache = new Map();

export function configureNovelsparadiseNativeFetch(options) {
  configureSourceNativeFetch(options);
}

function createFetcher(baseUrl = DEFAULT_BASE_URL) {
  return createCachedHtmlFetcher({
    ttlMs: 3 * 60_000,
    timeoutMs: 40_000,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ar,en-US;q=0.9,en;q=0.8",
      referer: `${baseUrl}/`,
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
      ? "حماية Novels Paradise تمنع الاتصال (Cloudflare)"
      : `Novels Paradise a répondu ${lastStatus}`),
    preferFlareSolverr: true,
  });
}

function isParadiseCatalogUrl(url = "") {
  try {
    return new URL(url, DEFAULT_BASE_URL).pathname.startsWith("/series");
  } catch {
    return false;
  }
}

export function paradiseCatalogHtmlLooksValid(html = "") {
  if (!html || isCloudflareChallengeHtml(html)) return false;
  return /<article\b|ts-post-image|class="[^"]*maindet|epcl-/i.test(html);
}

export function paradiseChapterHtmlLooksValid(html = "") {
  if (!html || isCloudflareChallengeHtml(html)) return false;
  return /epcontent|entry-content|text-chapter/i.test(html);
}

function assertParadiseCatalogHtml(url, html) {
  if (!isParadiseCatalogUrl(url) || paradiseCatalogHtmlLooksValid(html)) return;
  throw new Error("حماية Novels Paradise تمنع الاتصال (Cloudflare)");
}

function assertParadiseHost(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("المصدر غير مسموح");
  }
  url.hostname = ctx.apex;
  url.hash = "";
  return url;
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

export function normalizeSeriesUrl(rawUrl, baseUrl = DEFAULT_BASE_URL) {
  const ctx = createHostContext(baseUrl);
  const url = assertParadiseHost(rawUrl, ctx);
  const slug = slugFromPath(url.pathname);
  if (!slug) throw new Error("رابط Novels Paradise غير صالح");
  return buildSeriesUrl(seriesSlugFromSlug(slug), ctx.baseUrl);
}

export function normalizeChapterUrl(rawUrl, baseUrl = DEFAULT_BASE_URL) {
  const ctx = createHostContext(baseUrl);
  const url = assertParadiseHost(rawUrl, ctx);
  const slug = slugFromPath(url.pathname);
  if (!slug || slug === "series") throw new Error("رابط فصل Novels Paradise غير صالح");
  if (!/-\d+$/.test(slug)) throw new Error("رابط فصل Novels Paradise غير صالح");
  return `${ctx.baseUrl}/${slug}/`;
}

export function normalizeParadiseChapterList(chapters = []) {
  return enrichChapterDates(normalizeChapterList(chapters));
}

export function mapParadiseChapterEntry({
  url = "",
  eplNum = "",
  eplTitle = "",
  date = "",
  locked = false,
} = {}, ctx = DEFAULT_CTX) {
  const absoluteUrl = new URL(decodeHtml(url), ctx.baseUrl).toString();
  const chapterSlug = slugFromPath(new URL(absoluteUrl).pathname);
  if (!isParadiseChapterSlug(chapterSlug)) return null;
  const number = String(
    extractChapterNumberFromUrl(absoluteUrl)
    || (textOnly(eplNum).match(/(\d+(?:\.\d+)?)/) || textOnly(eplTitle).match(/(\d+(?:\.\d+)?)/) || [])[1]
    || "",
  ).trim();
  if (!number) return null;
  const title = textOnly(eplTitle || eplNum || "");
  const displayName = title && title !== number ? `${number} · ${title}` : (title || number);
  return {
    url: absoluteUrl,
    name: locked ? `🔒 ${displayName}` : displayName,
    number,
    date: textOnly(date || ""),
    locked: Boolean(locked),
  };
}

export function isParadiseChapterSlug(slug) {
  return Boolean(slug) && slug !== "series" && /-\d+$/.test(slug);
}

export function resolveParadiseSeriesUrl(chapterUrl, seriesUrl = "") {
  if (seriesUrl) {
    try {
      return normalizeSeriesUrl(seriesUrl);
    } catch {
      // Fall back to chapter-derived series URL.
    }
  }
  return normalizeSeriesUrl(chapterUrl);
}

function assertParadiseImageUrl(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("رابط الصورة غير مسموح");
  }
  return url.toString();
}

function parseImageUrl(tag = "") {
  const dataLazy = tag.match(/data-lazy-src=["']([^"']+)["']/i)?.[1];
  const dataSrc = tag.match(/data-src=["']([^"']+)["']/i)?.[1];
  const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
  return decodeHtml(dataLazy || dataSrc || src || "");
}

export function hasArabicScript(text = "") {
  return /[\u0600-\u06FF]/.test(text);
}

export function cleanParadiseTitle(text = "", { stripNovelPrefix = false } = {}) {
  let cleaned = textOnly(text)
    .replace(/\*+/g, "")
    .replace(/^[“”"'\s]+|[“”"'\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripNovelPrefix) cleaned = cleaned.replace(/^رواية\s+/iu, "").trim();
  return cleaned;
}

export function resolveParadiseTitles(primary = "", alternate = "") {
  const a = cleanParadiseTitle(primary);
  const b = cleanParadiseTitle(alternate, { stripNovelPrefix: true });
  if (!b) return { title: a, altTitle: "" };
  if (!a) return { title: b, altTitle: "" };
  const aAr = hasArabicScript(a);
  const bAr = hasArabicScript(b);
  if (bAr && !aAr) return { title: b, altTitle: a };
  if (aAr && !bAr) return { title: a, altTitle: b };
  if (a !== b) return { title: a, altTitle: b };
  return { title: a, altTitle: "" };
}

function parseCatalogArabicTitleFromExcerpt(article = "") {
  const excerpt = textOnly(article.match(/class="[^"]*contexcerpt[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
  const matches = [...excerpt.matchAll(/رواية\s+((?:[\u0600-\u06FF][\u0600-\u06FF\s'’\-:،؛!؟.]*?))\s+مترجمة/giu)];
  if (!matches.length) return "";
  return matches.sort((a, b) => b[1].length - a[1].length)[0][1].trim();
}

function parseArticleTitleAndHref(article) {
  const headline = article.match(/<h[23][^>]*itemprop=["']headline["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*(?:title=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/a>/i);
  if (headline) {
    return { href: decodeHtml(headline[1]), title: headline[2] || headline[3] };
  }
  const coverLink = article.match(/<a\b[^>]*class=["'][^"']*(?:thumb|series|l[^"']*)["'][^>]*href=["']([^"']+)["'][^>]*(?:title=["']([^"']*)["'])?/i)
    ?? article.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*title=["']([^"']+)["'][^>]*>\s*<img/i);
  if (coverLink) {
    return { href: decodeHtml(coverLink[1]), title: coverLink[2] || "" };
  }
  const forward = article.match(/<a\b[^>]*title=["']([^"']+)["'][^>]*href=["']([^"']+)["']/i);
  if (forward) return { title: forward[1], href: forward[2] };
  const reverse = article.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/i);
  if (reverse) return { title: reverse[2], href: reverse[1] };
  const hrefOnly = article.match(/<a\b[^>]*href=["'](\/series\/[^"']+\/?)["']/i);
  if (hrefOnly) {
    const title = article.match(/\btitle=["']([^"']+)["']/i)?.[1] ?? "";
    return { href: hrefOnly[1], title };
  }
  return null;
}

function defaultExtractCatalogChapterNumber(text = "", chapterUrl = "") {
  return extractChapterNumberFromUrl(chapterUrl)
    || textOnly(text).match(/(\d+(?:\.\d+)?)/)?.[1]
    || "";
}

export function parseCatalogChaptersFromArticle(article, baseUrl = DEFAULT_BASE_URL, extractNumber = defaultExtractCatalogChapterNumber) {
  const chapters = [];
  for (const match of article.matchAll(/class="[^"]*nchapter[^"]*"[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const chapterUrl = new URL(decodeHtml(match[1]), baseUrl).toString();
    const label = textOnly(match[2]);
    const number = extractNumber(label, chapterUrl);
    if (!chapterUrl || !number) continue;
    chapters.push({ number, name: label || number, url: chapterUrl });
  }
  return applyRecentChapterFields(
    { latestChapter: "—", latestChapterUrl: null, recentChapters: [] },
    recentChaptersFromList(normalizeParadiseChapterList(chapters)),
  );
}

export async function enrichParadiseCatalogItems(items, fetchHtml, parseChapters, { concurrency = 6 } = {}) {
  return enrichCatalogItems(items, {
    concurrency,
    needsEnrich: (item) => catalogNeedsRecentEnrich(item, 1),
    enrichItem: async (item) => {
      const cached = paradiseSeriesChaptersCache.get(item.url);
      if (cached && Date.now() - cached.at < PARADISE_SERIES_CHAPTERS_CACHE_TTL_MS) {
        return cached.chapters;
      }
      const html = await fetchHtml(item.url);
      const chapters = recentChaptersFromList(parseChapters(html, item.url));
      paradiseSeriesChaptersCache.set(item.url, { at: Date.now(), chapters });
      return chapters;
    },
  });
}

async function enrichParadiseCatalog(items, fetchHtml, ctx = DEFAULT_CTX) {
  return enrichParadiseCatalogItems(
    items,
    fetchHtml,
    (html, url) => parseParadiseChapters(html, url, ctx),
    { concurrency: 6 },
  );
}

export function catalogHasMorePages(html, page = 1, pageSize = PARADISE_CATALOG_PAGE_SIZE) {
  if (!html) return false;
  if (/<link\b[^>]*rel=["']next["']/i.test(html)) return true;

  const pageFromHref = (href = "") => {
    const match = href.match(/[?&]page=(\d+)/i);
    return match ? Number(match[1]) : 0;
  };

  const hpageBlock = html.match(/<div[^>]*class="[^"]*hpage[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  if (hpageBlock) {
    const linkedPages = [...hpageBlock.matchAll(/[?&]page=(\d+)/gi)].map((match) => Number(match[1]));
    const maxLinkedPage = linkedPages.reduce((max, value) => Math.max(max, value), 0);
    if (maxLinkedPage > page) return true;

    const nextLinks = [...hpageBlock.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?Next/gi)];
    for (const match of nextLinks) {
      const linkedPage = pageFromHref(match[1]);
      if (linkedPage > page) return true;
    }
  }

  const nextClassLinks = [...html.matchAll(/<a\b[^>]*class="[^"]*next[^"]*"[^>]*href=["']([^"']+)["']/gi)];
  for (const match of nextClassLinks) {
    const linkedPage = pageFromHref(match[1]);
    if (!linkedPage || linkedPage > page) return true;
  }

  const itemCount = (html.match(/<article\b/gi) || []).length;
  return itemCount >= pageSize;
}

function extractParadiseFiltersForm(html = "") {
  return html.match(/<form[^>]*class=["'][^"']*filters[^"']*["'][^>]*>[\s\S]*?<\/form>/i)?.[0] ?? "";
}

function decodeParadiseFilterValue(raw = "") {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return decodeHtml(raw);
  }
}

function isLatinFilterSlug(value = "") {
  return /^[a-z0-9_-]+$/i.test(String(value || "").trim());
}

function scoreParadiseFilterValue(decoded = "", raw = "") {
  if (isLatinFilterSlug(decoded)) return 3;
  if (isLatinFilterSlug(raw)) return 2;
  return 1;
}

export function parseParadiseFilterCheckboxes(html, fieldName) {
  const form = extractParadiseFiltersForm(html);
  const byName = new Map();
  const pattern = new RegExp(
    `<li>\\s*<input\\b[^>]*\\bname=["']${fieldName}\\[\\]["'][^>]*\\bvalue=["']([^"']*)["'][^>]*>\\s*<label\\b[^>]*>([\\s\\S]*?)<\\/label>\\s*<\\/li>`,
    "gi",
  );
  for (const match of form.matchAll(pattern)) {
    const rawValue = match[1];
    const decoded = decodeParadiseFilterValue(rawValue);
    const name = textOnly(match[2]);
    const key = name.toLocaleLowerCase("ar");
    if (!decoded || !name) continue;
    const slug = decoded;
    const filterQueryValue = isLatinFilterSlug(decoded)
      ? decoded
      : (isLatinFilterSlug(rawValue) ? decodeParadiseFilterValue(rawValue) : decoded);
    const candidate = { slug, name, count: 0, filterQueryValue };
    const existing = byName.get(key);
    if (!existing || scoreParadiseFilterValue(candidate.filterQueryValue, candidate.slug)
      > scoreParadiseFilterValue(existing.filterQueryValue, existing.slug)) {
      byName.set(key, candidate);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export function parseParadiseFilters(html) {
  return {
    categories: parseParadiseFilterCheckboxes(html, "genre"),
    tags: parseParadiseFilterCheckboxes(html, "type"),
  };
}

function assertParadiseFilterSlug(value, label) {
  const slug = value?.trim() ?? "";
  if (!slug) return "";
  if (!/^[\p{L}\p{N}+_.-]+$/u.test(slug)) throw new Error(`${label} Novels Paradise غير صالح`);
  return slug;
}

function buildParadiseCatalogUrl(page, { status = "", order = "latest", genre = "", tag = "" } = {}, baseUrl = DEFAULT_BASE_URL) {
  const query = new URL(`${baseUrl}/series/`);
  query.searchParams.set("page", String(page));
  query.searchParams.set("status", status);
  query.searchParams.set("order", order);
  if (genre) query.searchParams.append("genre[]", genre);
  if (tag) query.searchParams.append("type[]", tag);
  return query.toString();
}

function mapCatalogItem(rawTitle, href, cover, article = "", baseUrl = DEFAULT_BASE_URL) {
  const slug = seriesSlugFromSlug(slugFromPath(new URL(href, baseUrl).pathname));
  const alter = article.match(/<span class="alter">([\s\S]*?)<\/span>/i)?.[1] ?? "";
  const excerptTitle = parseCatalogArabicTitleFromExcerpt(article);
  const { title, altTitle } = resolveParadiseTitles(rawTitle || excerptTitle, alter || excerptTitle);
  return {
    id: slug,
    title,
    altTitle,
    url: buildSeriesUrl(slug, baseUrl),
    cover: decodeHtml(cover),
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    ...parseCatalogChaptersFromArticle(article, baseUrl),
  };
}

export function parseParadiseCatalog(html, baseUrl = DEFAULT_BASE_URL) {
  const results = [];
  const seen = new Set();
  const articlePattern = /<article\b[\s\S]*?<\/article>/gi;
  for (const block of html.matchAll(articlePattern)) {
    const article = block[0];
    if (!/maindet|ts-post-image|nchapter|contexcerpt|itemprop=["']headline["']/i.test(article)) continue;
    const link = parseArticleTitleAndHref(article);
    if (!link?.href) continue;
    const imageTag = article.match(/<img\b[^>]*class="[^"]*ts-post-image[^"]*"[^>]*>/i)?.[0]
      ?? article.match(/<img\b[^>]*>/i)?.[0]
      ?? "";
    const cover = parseImageUrl(imageTag);
    const item = mapCatalogItem(link.title, link.href, cover, article, baseUrl);
    if (!item.title || !item.url.includes("/series/") || seen.has(item.id)) continue;
    seen.add(item.id);
    results.push(item);
  }
  return results;
}

export function extractEplisterListBlocks(html) {
  const pattern = /<div[^>]*class="[^"]*\beplister\b[^"]*"[^>]*>[\s\S]*?<ul\b[^>]*>([\s\S]*?)<\/ul>/gi;
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

export function parseParadiseChapters(html, seriesUrl, ctx = DEFAULT_CTX) {
  const chapters = [];
  const seen = new Set();
  const eplisterBlocks = extractEplisterListBlocks(html);
  if (!eplisterBlocks.length) {
    return chapters;
  }
  for (const eplisterBlock of eplisterBlocks) {
    for (const match of eplisterBlock.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      const block = match[1];
      const link = block.match(/<a\b[^>]*href=["']([^"']+)["']/i);
      if (!link) continue;
      const chapterUrl = decodeHtml(link[1]);
      if (seen.has(chapterUrl)) continue;
      seen.add(chapterUrl);
      const eplNum = block.match(/class="[^"]*epl-num[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "";
      const eplTitle = block.match(/class="[^"]*epl-title[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "";
      const date = block.match(/class="[^"]*epl-date[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "";
      const locked = /fa-lock|🔒|مدفوع/i.test(block);
      const entry = mapParadiseChapterEntry({ url: chapterUrl, eplNum, eplTitle, date, locked }, ctx);
      if (entry) chapters.push(entry);
    }
  }
  return normalizeParadiseChapterList(chapters);
}

async function fetchParadiseChapterHtml(chapterUrl, remoteFetcher) {
  return remoteFetcher(chapterUrl);
}

function parseParadiseDetails(html, url, ctx = DEFAULT_CTX) {
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
  const chapters = parseParadiseChapters(html, url, ctx);
  const taxonomies = parseDetailTaxonomies(html, ctx.baseUrl);
  const seriesSlug = seriesSlugFromSlug(slugFromPath(new URL(url).pathname));
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
  }, { html, parser: "madara" });
}

async function fetchParadiseTaxonomyFilters(ctx, fetchHtml) {
  const cacheKey = ctx.baseUrl;
  const cached = paradiseFiltersCache.get(cacheKey);
  if (cached && Date.now() - cached.at < PARADISE_FILTERS_CACHE_TTL_MS) return cached.data;
  const target = buildParadiseCatalogUrl(1, {}, ctx.baseUrl);
  const html = await fetchHtml(target);
  const data = parseParadiseFilters(html);
  paradiseFiltersCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

export async function fetchParadiseCatalogPage(ctx, fetchHtml, {
  page = 1,
  order = "latest",
  genre = "",
  tag = "",
  status = "",
} = {}) {
  const offset = (page - 1) * PARADISE_CATALOG_PAGE_SIZE;
  const upstreamPage = Math.floor(offset / UPSTREAM_CATALOG_PAGE_SIZE) + 1;
  const start = offset % UPSTREAM_CATALOG_PAGE_SIZE;
  const needsSpill = start + PARADISE_CATALOG_PAGE_SIZE > UPSTREAM_CATALOG_PAGE_SIZE;

  const fetchUpstream = async (upstream) => {
    const target = buildParadiseCatalogUrl(upstream, { status, order, genre, tag }, ctx.baseUrl);
    const html = await fetchHtml(target);
    assertParadiseCatalogHtml(target, html);
    return { html, items: parseParadiseCatalog(html, ctx.baseUrl) };
  };

  const [first, second] = await Promise.all([
    fetchUpstream(upstreamPage),
    needsSpill ? fetchUpstream(upstreamPage + 1).catch(() => ({ html: "", items: [] })) : Promise.resolve({ html: "", items: [] }),
  ]);

  const pool = [...first.items];
  if (needsSpill && second.items.length) pool.push(...second.items);

  let items = pool.slice(start, start + PARADISE_CATALOG_PAGE_SIZE);
  let nextUpstream = upstreamPage + (needsSpill ? 2 : 1);
  let lastHtml = needsSpill ? second.html : first.html;
  let hasMoreUpstream = catalogHasMorePages(lastHtml || first.html, needsSpill ? upstreamPage + 1 : upstreamPage);

  while (items.length < PARADISE_CATALOG_PAGE_SIZE && hasMoreUpstream && nextUpstream <= upstreamPage + 4) {
    const extra = await fetchUpstream(nextUpstream).catch(() => ({ html: "", items: [] }));
    if (!extra.items.length) break;
    pool.push(...extra.items);
    items = pool.slice(start, start + PARADISE_CATALOG_PAGE_SIZE);
    lastHtml = extra.html;
    hasMoreUpstream = catalogHasMorePages(extra.html, nextUpstream);
    nextUpstream += 1;
  }

  await enrichParadiseCatalog(items, fetchHtml, ctx);

  return {
    items,
    page,
    genre,
    tag,
    hasMore: items.length === PARADISE_CATALOG_PAGE_SIZE && hasMoreUpstream,
    fetchedAt: new Date().toISOString(),
  };
}

const PARADISE_PAYWALL_RE = /تفعيل JavaScript|unlock|اشترك/i;
const SCRAMBLED_PARAGRAPH_RATIO = 0.32;
const KOLNOVEL_HASH_PARAGRAPH_RE = /<p class='[a-f0-9]{16,}'[^>]*>[\s\S]*?<p class="[a-f0-9]{16,}"/i;
const PARADISE_JUNK_PARAGRAPH_RE = /\.shola-|function\s+sholaTab|#366ad3|wp-admin\/admin-ajax|chapter-countdown/i;

function isParadiseDialogueMarker(text = "") {
  const trimmed = String(text || "").trim();
  return trimmed.length > 0 && /^[-—–‐‑‒―….\s]+$/.test(trimmed);
}

function isParadiseParagraphText(text) {
  if (isParadiseDialogueMarker(text)) return true;
  return Boolean(
    text
    && text.length > 1
    && !PARADISE_PAYWALL_RE.test(text)
    && !PARADISE_JUNK_PARAGRAPH_RE.test(text)
    && !isNovelBoilerplateParagraph(text),
  );
}

function sanitizeParadiseContentBlock(htmlBlock = "") {
  return htmlBlock
    .replace(/<div[^>]*class="[^"]*\bshola[\s\S]*$/i, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
}

function isKolnovelHashParagraphMode(htmlBlock = "") {
  return KOLNOVEL_HASH_PARAGRAPH_RE.test(htmlBlock);
}

function dedupeConsecutiveParagraphs(paragraphs = []) {
  return paragraphs.filter((paragraph, index) => index === 0 || paragraph !== paragraphs[index - 1]);
}

export function extractBalancedDivInnerHtml(html, classPattern) {
  const startMatch = html.match(classPattern);
  if (!startMatch) return "";
  const start = startMatch.index + startMatch[0].length;
  let depth = 1;
  let index = start;
  while (index < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", index);
    const nextClose = html.indexOf("</div>", index);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      index = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) return html.slice(start, nextClose);
      index = nextClose + 6;
    }
  }
  return html.slice(start);
}

function extractLeafParagraphs(htmlBlock = "") {
  return [...htmlBlock.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => textOnly(match[1]))
    .filter(isParadiseParagraphText);
}

function extractOuterParagraphUnits(htmlBlock = "") {
  const paragraphs = [];
  const outerRe = /<p class='[^']+'/gi;
  const indices = [];
  let match;
  while ((match = outerRe.exec(htmlBlock))) indices.push(match.index);
  for (let index = 0; index < indices.length; index += 1) {
    const chunk = htmlBlock.slice(indices[index], indices[index + 1] ?? htmlBlock.length);
    const text = textOnly(chunk);
    if (isParadiseParagraphText(text)) paragraphs.push(text);
  }
  return paragraphs;
}

function extractOuterDirectParagraphs(htmlBlock = "") {
  const paragraphs = [];
  const outerRe = /<p class='[^']+'[^>]*>/gi;
  let match;
  while ((match = outerRe.exec(htmlBlock))) {
    const rest = htmlBlock.slice(match.index + match[0].length);
    const nestedIdx = rest.search(/<p\b/i);
    const untilClose = rest.search(/<\/p>/i);
    const boundary = nestedIdx >= 0 && (untilClose < 0 || nestedIdx < untilClose) ? nestedIdx : untilClose;
    const chunk = boundary >= 0 ? rest.slice(0, boundary) : rest;
    const text = textOnly(chunk);
    if (isParadiseParagraphText(text)) paragraphs.push(text);
  }
  return paragraphs;
}

function shouldUseScrambledParagraphMode(htmlBlock = "") {
  const outerRe = /<p class='[^']+'/gi;
  const indices = [];
  let match;
  while ((match = outerRe.exec(htmlBlock))) indices.push(match.index);
  if (indices.length < 4) return false;

  let scrambled = 0;
  for (let index = 0; index < indices.length; index += 1) {
    const chunk = htmlBlock.slice(indices[index], indices[index + 1] ?? htmlBlock.length);
    const open = chunk.match(/^<p class='[^']+'[^>]*>/i)?.[0] ?? "";
    const rest = chunk.slice(open.length);
    const nestedIdx = rest.search(/<p class="/i);
    if (nestedIdx < 0) continue;
    const direct = textOnly(rest.slice(0, nestedIdx));
    const inner = textOnly(rest.slice(nestedIdx).match(/<p class="[^"]+">([\s\S]*?)<\/p>/i)?.[1] ?? "");
    if (direct.length < 50 && inner.length > 30 && !inner.includes(direct) && !direct.includes(inner)) {
      scrambled += 1;
    }
  }
  return scrambled / indices.length >= SCRAMBLED_PARAGRAPH_RATIO;
}

export function extractParadiseParagraphs(htmlBlock = "") {
  const cleanedBlock = sanitizeParadiseContentBlock(htmlBlock);
  if (!cleanedBlock) return [];

  const blockquoteParagraphs = [...cleanedBlock.matchAll(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi)]
    .flatMap((match) => extractLeafParagraphs(match[1]))
    .filter(isParadiseParagraphText);

  const hasNestedOuterParagraphs = /<p class='[^']+'/i.test(cleanedBlock);
  if (hasNestedOuterParagraphs) {
    const paragraphs = (isKolnovelHashParagraphMode(cleanedBlock) || shouldUseScrambledParagraphMode(cleanedBlock))
      ? extractOuterDirectParagraphs(cleanedBlock)
      : extractOuterParagraphUnits(cleanedBlock);
    if (paragraphs.length) {
      return dedupeConsecutiveParagraphs([...blockquoteParagraphs, ...paragraphs]);
    }
  }

  const leafParagraphs = extractLeafParagraphs(cleanedBlock);
  if (leafParagraphs.length) return dedupeConsecutiveParagraphs(leafParagraphs);
  return dedupeConsecutiveParagraphs(blockquoteParagraphs);
}

export function parseParadiseChapter(html, url) {
  const title = textOnly(
    html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
    ?? "",
  );

  const epcontentPattern = /<div[^>]*class="[^"]*epcontent[^"]*entry-content[^"]*"[^>]*>/i;
  let bestBlock = extractBalancedDivInnerHtml(html, epcontentPattern);
  let bestLength = textOnly(bestBlock).length;

  if (bestLength < 100) {
    const shallowBlocks = [...html.matchAll(/<div[^>]*class="[^"]*epcontent[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
    shallowBlocks.forEach((match) => {
      const length = textOnly(match[1]).length;
      if (length > bestLength) {
        bestLength = length;
        bestBlock = match[1];
      }
    });
  }

  const fallbackSelectors = [
    /<div[^>]*id=["']chapter-content["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*reading-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*chapter-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];
  if (bestLength < 100) {
    for (const pattern of fallbackSelectors) {
      const match = html.match(pattern);
      if (match && textOnly(match[1]).length > bestLength) {
        bestBlock = match[1];
        bestLength = textOnly(bestBlock).length;
      }
    }
  }

  const paragraphs = extractParadiseParagraphs(bestBlock);

  return {
    title: title || "فصل",
    url,
    kind: "novel",
    paragraphs,
    pages: [],
  };
}

export async function handleNovelsParadiseRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: SOURCE_NAME });
  const remoteFetcher = createFetcher(ctx.baseUrl);
  const fetchHtml = remoteFetcher;

  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(assertParadiseImageUrl(requestUrl.searchParams.get("url") ?? "", ctx), `${ctx.baseUrl}/`, SOURCE_NAME);
  }
  if (requestUrl.pathname.endsWith("/filters")) {
    const filters = await fetchParadiseTaxonomyFilters(ctx, fetchHtml);
    return responseJson(200, { ...filters, fetchedAt: new Date().toISOString() });
  }
  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const order = requestUrl.searchParams.get("order")?.trim() || "latest";
    const genre = assertParadiseFilterSlug(requestUrl.searchParams.get("genre"), "تصنيف");
    const tag = assertParadiseFilterSlug(requestUrl.searchParams.get("tag"), "وسم");
    return responseJson(200, await fetchParadiseCatalogPage(ctx, fetchHtml, {
      page,
      order,
      genre,
      tag,
      status: requestUrl.searchParams.get("status") ?? "",
    }));
  }
  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = assertParadiseFilterSlug(requestUrl.searchParams.get("genre"), "تصنيف");
    const tag = assertParadiseFilterSlug(requestUrl.searchParams.get("tag"), "وسم");
    const target = new URL(`${ctx.baseUrl}/series/`);
    target.searchParams.set("page", String(page));
    target.searchParams.set("s", query);
    if (genre) target.searchParams.append("genre[]", genre);
    if (tag) target.searchParams.append("type[]", tag);
    const html = await fetchHtml(target.toString());
    assertParadiseCatalogHtml(target.toString(), html);
    const items = parseParadiseCatalog(html, ctx.baseUrl).slice(0, PARADISE_CATALOG_PAGE_SIZE);
    await enrichParadiseCatalog(items, fetchHtml, ctx);
    return responseJson(200, {
      items,
      page,
      hasMore: catalogHasMorePages(html, page) && items.length === PARADISE_CATALOG_PAGE_SIZE,
    });
  }
  if (requestUrl.pathname.endsWith("/manga")) {
    const target = normalizeSeriesUrl(requestUrl.searchParams.get("url") ?? "", ctx.baseUrl);
    const html = await fetchHtml(target);
    return responseJson(200, parseParadiseDetails(html, target, ctx));
  }
  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = normalizeChapterUrl(requestUrl.searchParams.get("url") ?? "", ctx.baseUrl);
    const html = await fetchParadiseChapterHtml(target, remoteFetcher);
    return responseJson(200, parseParadiseChapter(html, target));
  }
  return responseJson(404, { error: "Route Novels Paradise inconnue" });
}
