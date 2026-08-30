import { decodeHtml, mergeFilterGroups, parseDetailTaxonomies, parseTaxonomyFilterLinks, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, enrichCatalogItems } from "../lib/catalogChapters.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import { filterNovelParagraphs } from "../lib/novelChapterText.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";
import { configureSourceNativeFetch, fetchNativeHtml, fetchNativeImage, hasNativeHtmlFetcher } from "../lib/nativeFetchBridge.js";
import { isCloudflareChallengeHtml } from "../lib/cloudflareDetect.js";

const DEFAULT_BASE_URL = "https://galaxynovels.com";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
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

async function fetchGalaxyNovelApi(novelId) {
  const cacheKey = `${DEFAULT_BASE_URL}/wp-json/wor-reader-app/v1/novels/${novelId}`;
  const cached = galaxyNovelApiCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.data;
  const response = await fetch(cacheKey, {
    headers: GALAXY_JSON_HEADERS(),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`واجهة رواية Galaxy Novels غير متاحة (${response.status})`);
  const payload = await response.json();
  const data = payload?.data || payload || {};
  galaxyNovelApiCache.set(cacheKey, { at: Date.now(), data });
  return data;
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

export function parseGalaxyCatalog(html = "") {
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
    const url = toGalaxyAbsoluteUrl(link.url);
    if (seen.has(url)) continue;
    const imageTag = block.match(/<img[^>]*class=["'][^"']*wor-cover-img[^"']*["'][^>]*>/i)?.[0]
      ?? block.match(/<img[^>]*>/i)?.[0]
      ?? "";
    const chapterCount = textOnly(block.match(/<b[^>]*data-wor-library-chapter-count[^>]*>([\s\S]*?)<\/b>/i)?.[1] ?? "0");
    const status = textOnly(block.match(/<b>([^<]+)<\/b><small>الحالة<\/small>/i)?.[1] ?? "");
    const summary = textOnly(block.match(/<div[^>]*class=["'][^"']*wor-single-summary__text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
    seen.add(url);
    results.push(applyRecentChapterFields({
      id: new URL(url).pathname.split("/").filter(Boolean).pop(),
      novelId,
      title: textOnly(link.title),
      url,
      cover: imageFromGalaxyTag(imageTag),
      summary,
      chapterCount: Number(chapterCount) || 0,
      status,
      source: "Galaxy Novels",
      sourceId: "galaxynovels",
      mediaType: "novel",
      mediaTypeLabel: "رواية",
    }, []));
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

async function fetchGalaxyChapterManifest(novelId) {
  const cacheKey = `${DEFAULT_BASE_URL}/wp-content/uploads/wor-reader-cache/chapters/manifest/novel-${novelId}.json`;
  const cached = galaxyManifestCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.data;
  const response = await fetch(cacheKey, {
    headers: GALAXY_JSON_HEADERS(),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`manifeste Galaxy Novels indisponible (${response.status})`);
  const data = await response.json();
  galaxyManifestCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

function recentChaptersFromManifest(manifest) {
  const tail = Array.isArray(manifest?.live_tail) ? manifest.live_tail : [];
  const latestUrl = manifest?.latest_url ? toGalaxyAbsoluteUrl(manifest.latest_url) : "";
  const latestNumber = manifest?.latest_number;
  const chapters = [...tail]
    .sort((a, b) => Number(b.position || b.number || 0) - Number(a.position || a.number || 0))
    .map((chapter) => ({
      url: chapter.url ? toGalaxyAbsoluteUrl(chapter.url) : "",
      number: String(chapter.number || chapter.position || ""),
      name: chapter.label || String(chapter.number || chapter.position || ""),
      date: chapter.date_iso || chapter.date || "",
      locked: false,
    }))
    .filter((chapter) => chapter.url && chapter.number);
  if (latestUrl && latestNumber && !chapters.some((chapter) => chapter.url === latestUrl)) {
    chapters.unshift({
      url: latestUrl,
      number: String(latestNumber),
      name: String(latestNumber),
      date: "",
      locked: false,
    });
  }
  return chapters;
}

async function fetchGalaxyChapterIndex(novelId, rawIndexUrl = "") {
  const target = rawIndexUrl || `${DEFAULT_BASE_URL}/wp-content/uploads/wor-reader-cache/chapters/novel-${novelId}.json`;
  const url = new URL(decodeHtml(target));
  if (url.protocol !== "https:" || url.hostname !== "galaxynovels.com" || !/^\/wp-content\/uploads\/wor-reader-cache\/chapters\/novel-\d+\.json$/i.test(url.pathname)) throw new Error("فهرس فصول Galaxy Novels غير صالح");
  const cacheKey = url.toString();
  const cached = galaxyIndexCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.data;
  const response = await fetch(cacheKey, { headers: GALAXY_JSON_HEADERS(), signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`فهرس فصول Galaxy Novels غير متاح (${response.status})`);
  const data = await response.json();
  galaxyIndexCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

async function fetchGalaxyChapterApi(rawApiUrl) {
  const url = new URL(rawApiUrl, DEFAULT_BASE_URL);
  if (url.protocol !== "https:" || url.hostname !== "galaxynovels.com" || !/^\/wp-json\/wor-reader-app\/v1\/chapters\/\d+\/?$/i.test(url.pathname)) throw new Error("واجهة فصل Galaxy Novels غير صالحة");
  const response = await fetch(url, { headers: GALAXY_JSON_HEADERS(), signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`واجهة فصل Galaxy Novels غير متاحة (${response.status})`);
  return response.json();
}

function mapGalaxyChapters(index) {
  return [...(index?.chapters || [])]
    .sort((a, b) => Number(b.position || b.number || 0) - Number(a.position || a.number || 0))
    .map((chapter) => ({
      url: chapter.url ? toGalaxyAbsoluteUrl(chapter.url) : "",
      name: chapter.title ? `${chapter.number} · ${chapter.title}` : String(chapter.number || chapter.label || ""),
      number: String(chapter.number || chapter.position || ""),
      date: chapter.date || "",
      locked: false,
      contentApi: chapter.content_api ? toGalaxyAbsoluteUrl(chapter.content_api) : "",
    }))
    .filter((chapter) => chapter.url && chapter.number);
}

async function enrichGalaxyCatalog(items, { concurrency = 6 } = {}) {
  return enrichCatalogItems(items, {
    concurrency,
    enrichItem: async (item) => {
      const manifest = await fetchGalaxyChapterManifest(item.novelId);
      return recentChaptersFromManifest(manifest);
    },
  });
}

async function parseGalaxyDetails(html, url) {
  const pageTag = html.match(/<article[^>]*class="[^"]*wor-single-novel-page[^"]*"[^>]*>/i)?.[0] ?? "";
  const novelId = Number(pageTag.match(/data-novel-id="(\d+)"/i)?.[1] ?? 0);
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
  let author = parseGalaxyAuthorFromHtml(html);
  let altTitle = "";
  if (novelId) {
    try {
      const api = await fetchGalaxyNovelApi(novelId);
      author = textOnly(api.author || author);
      altTitle = textOnly(api.original_title || "");
    } catch { /* Passe au HTML. */ }
  }
  const title = textOnly(html.match(/<div[^>]*class="[^"]*wor-single-hero__body[^"]*"[^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const coverTag = html.match(/<div[^>]*class="[^"]*wor-single-hero__cover[^"]*"[^>]*>[\s\S]*?<img[^>]*class="[^"]*wor-cover-img[^"]*"[^>]*>/i)?.[0] ?? "";
  const cover = decodeHtml(coverTag.match(/data-src="([^"]+)"/i)?.[1] ?? html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ?? "");
  const summary = textOnly(html.match(/<div[^>]*class="[^"]*wor-single-summary__text[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? "");
  const indexUrl = decodeHtml(html.match(/data-index-url="([^"]+)"/i)?.[1] ?? "");
  let chapters = [];
  if (novelId) {
    try {
      chapters = mapGalaxyChapters(await fetchGalaxyChapterIndex(novelId, indexUrl));
    } catch {
      try {
        chapters = recentChaptersFromManifest(await fetchGalaxyChapterManifest(novelId));
      } catch { /* Passe au HTML rendu. */ }
    }
  }
  if (!chapters.length) {
    const seen = new Set();
    for (const match of html.matchAll(/<a[^>]*class="[^"]*wor-novel-chapter-item__num[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      if (seen.has(match[1])) continue;
      seen.add(match[1]);
      const number = textOnly(match[2]);
      chapters.push({ url: toGalaxyAbsoluteUrl(match[1]), name: number, number, date: "", locked: false });
    }
  }
  if (author) {
    chapters = chapters.map((chapter) => ({ ...chapter, author }));
  }
  const taxonomies = parseDetailTaxonomies(html, DEFAULT_BASE_URL);
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

export function parseGalaxyChapterApi(payload, fallbackUrl) {
  const chapter = payload?.data || payload || {};
  const html = chapter.content_html || chapter.content || chapter.html || "";
  const paragraphs = extractGalaxyParagraphs(html);
  const url = chapter.url ? toGalaxyAbsoluteUrl(chapter.url) : fallbackUrl;
  return { title: textOnly(chapter.display_title || chapter.title || chapter.label || ""), url, kind: "novel", paragraphs, pages: [] };
}

export async function handleGalaxyRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: "Galaxy Novels" });
  const fetchGalaxyHtml = createFetcher(ctx.baseUrl);

  if (requestUrl.pathname.endsWith("/image")) return await proxyGalaxyImage(requestUrl.searchParams.get("url") ?? "", ctx);
  if (requestUrl.pathname.endsWith("/filters")) {
    const html = await fetchGalaxyHtml(`${ctx.baseUrl}/library/`);
    const taxonomy = mergeFilterGroups([parseTaxonomyFilterLinks(html, ctx.baseUrl, [ctx.apex, ctx.hostname])]);
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
    let target;
    if (queryParam === "author" && queryValue) {
      target = `${ctx.baseUrl}/library/?q=${encodeURIComponent(queryValue)}&library_page=${page}`;
    } else {
      const filterTarget = new URL(filterPath || "/library/", ctx.baseUrl);
      if (queryParam && queryValue) filterTarget.searchParams.set(queryParam, queryValue);
      filterTarget.searchParams.set("library_page", String(page));
      target = filterTarget.toString();
    }
    const html = await fetchGalaxyHtml(target);
    const items = parseGalaxyCatalog(html);
    await enrichGalaxyCatalog(items, { concurrency: 6 });
    const nextPagePattern = new RegExp(`library_page=(?:${page + 1})(?:[&\"'])`, "i");
    return responseJson(200, { items, page, hasMore: nextPagePattern.test(html), fetchedAt: new Date().toISOString() });
  }
  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const html = await fetchGalaxyHtml(`${ctx.baseUrl}/library/?q=${encodeURIComponent(query)}`);
    const items = parseGalaxyCatalog(html);
    await enrichGalaxyCatalog(items, { concurrency: 4 });
    return responseJson(200, { items });
  }
  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertGalaxyUrl(requestUrl.searchParams.get("url") ?? "");
    return responseJson(200, await parseGalaxyDetails(await fetchGalaxyHtml(target), target));
  }
  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertGalaxyUrl(requestUrl.searchParams.get("url") ?? "", true);
    const apiUrl = requestUrl.searchParams.get("api") ?? "";
    if (apiUrl) {
      try {
        const parsed = parseGalaxyChapterApi(await fetchGalaxyChapterApi(apiUrl), target);
        if (parsed.paragraphs.length) return responseJson(200, parsed);
      } catch { /* La page HTML publique reste le repli. */ }
    }
    const parsed = parseGalaxyChapter(await fetchGalaxyHtml(target), target);
    if (!parsed.paragraphs.length) throw new Error("تعذر استخراج نص الفصل");
    return responseJson(200, parsed);
  }
  return responseJson(404, { error: "Route Galaxy Novels inconnue" });
}
