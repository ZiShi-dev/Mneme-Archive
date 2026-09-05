import { publicFetch } from "../lib/publicFetch.js";
import { decodeHtml, mergeFilterGroups, parseDetailTaxonomies, parseTaxonomyFilterLinks, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage, responseCache } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/responseJson.js";
import { applyRecentChapterFields, normalizeRecentChapters } from "../lib/catalogChapters.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";
import { filterNovelParagraphs } from "../lib/novelChapterText.js";
import { configureSourceNativeFetch, fetchNativeHtml, fetchNativeImage, hasNativeHtmlFetcher, invalidateNativeHtmlCacheSafe } from "../lib/nativeFetchBridge.js";
import { isCloudflareChallengeHtml } from "../lib/cloudflareDetect.js";

const DEFAULT_BASE_URL = "https://azorafly.com";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
const AZORA_API_URL = "https://api.azorafly.com";
const FILTERS_CACHE_TTL_MS = 10 * 60_000;
const AZORA_JSON_TTL_MS = 2 * 60_000;
const APP_PAGE_SIZE = 10;
const UPSTREAM_PAGE_SIZE = 48;

const azoraFiltersCache = new Map();
const azoraJsonCache = new Map();

export function configureAzoraflyNativeFetch(options) {
  configureSourceNativeFetch(options);
}

function isAzoraApiUrl(url = "") {
  try {
    return new URL(url).hostname === "api.azorafly.com";
  } catch {
    return false;
  }
}

function isAzoraSearchUrl(url = "") {
  try {
    return Boolean(new URL(url).searchParams.get("searchTerm")?.trim());
  } catch {
    return false;
  }
}

function isAzoraSeriesDetailPath(pathname = "") {
  const parts = String(pathname).split("/").filter(Boolean);
  return parts[0] === "series" && parts.length === 2;
}

function isAzoraChapterPath(pathname = "") {
  const parts = String(pathname).split("/").filter(Boolean);
  return parts[0] === "series" && parts.length >= 3;
}

/** Valide le HTML selon le type de page (catalogue, fiche, chapitre, recherche). */
export function azoraPageHtmlLooksValid(html = "", url = "") {
  if (!html || isCloudflareChallengeHtml(html)) return false;
  if (isAzoraApiUrl(url)) return true;
  if (String(html).length < 120) return false;
  if (isAzoraSearchUrl(url)) return String(html).length >= 80;

  let pathname = "";
  try { pathname = new URL(url).pathname; } catch { /* ignore */ }

  if (isAzoraChapterPath(pathname)) {
    return /bg-card|storage\.azorafly\.com|chapter|الفصل|novel-reader-content/i.test(html);
  }
  if (isAzoraSeriesDetailPath(pathname)) {
    return /bg-card|storage\.azorafly\.com|chapter|الفصل|Cover of/i.test(html);
  }
  return /bg-card|href=["']\/series\/|storage\.azorafly\.com/i.test(html);
}

function createFetcher(baseUrl = DEFAULT_BASE_URL) {
  const hostCtx = createHostContext(baseUrl);
  const fetchRemote = createCachedHtmlFetcher({
    ttlMs: 5 * 60_000,
    timeoutMs: 40_000,
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "ar,en;q=0.9",
      referer: `${baseUrl}/`,
      "cache-control": "no-cache",
      "user-agent": "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
    getVariants: (url) => {
      try {
        const parsed = new URL(url);
        const alt = new URL(url);
        alt.hostname = parsed.hostname === `www.${hostCtx.apex}` ? hostCtx.apex : `www.${hostCtx.apex}`;
        return alt.toString() === url ? [url] : [url, alt.toString()];
      } catch {
        return [url];
      }
    },
    buildError: (lastStatus) => (lastStatus === 403 ? "حماية AzoraFly منعت الاتصال مؤقتًا" : `AzoraFly a répondu ${lastStatus}`),
  });

  return async function fetchAzoraHtml(url, options = {}) {
    const html = await fetchNativeHtml(url, () => fetchRemote(url, options));
    if (isAzoraApiUrl(url)) return html;
    if (!hasNativeHtmlFetcher()) {
      if (isCloudflareChallengeHtml(html)) throw new Error("حماية AzoraFly تمنع الاتصال (Cloudflare)");
      if (azoraPageHtmlLooksValid(html, url)) return html;
      await bustAzoraHtmlCache(url);
      const retryHtml = await fetchRemote(url, options);
      if (!azoraPageHtmlLooksValid(retryHtml, url)) {
        throw new Error("تعذر تحميل صفحة AzoraFly، أعد المحاولة");
      }
      return retryHtml;
    }
    if (azoraPageHtmlLooksValid(html, url)) return html;
    try {
      const remote = await fetchRemote(url, options);
      if (azoraPageHtmlLooksValid(remote, url)) return remote;
    } catch {
      // Garde le HTML WebView si le repli HTTP échoue aussi.
    }
    if (isCloudflareChallengeHtml(html)) throw new Error("حماية AzoraFly تمنع الاتصال (Cloudflare)");
    if (html && String(html).length > 400 && azoraPageHtmlLooksValid(html, url)) return html;
    return fetchRemote(url, options);
  };
}

function bustHtmlCache(url) {
  responseCache.delete(url);
  responseCache.delete(`${url}#flare-assets`);
}

async function bustAzoraHtmlCache(url) {
  bustHtmlCache(url);
  await invalidateNativeHtmlCacheSafe(url);
}

async function resolveAzoraHtml(url, fetchAzoraHtml, options = {}) {
  const html = await fetchAzoraHtml(url, options);
  if (isCloudflareChallengeHtml(html)) throw new Error("حماية AzoraFly تمنع الاتصال (Cloudflare)");
  if (azoraPageHtmlLooksValid(html, url)) return html;

  await bustAzoraHtmlCache(url);
  const retryUrl = `${url}${url.includes("?") ? "&" : "?"}_retry=${Date.now()}`;
  const retryHtml = await fetchAzoraHtml(retryUrl, options);
  if (!azoraPageHtmlLooksValid(retryHtml, url)) {
    throw new Error("تعذر تحميل صفحة AzoraFly، أعد المحاولة");
  }
  return retryHtml;
}

async function resolveAzoraSearchHtml(url, fetchAzoraHtml) {
  const html = await fetchAzoraHtml(url);
  if (isCloudflareChallengeHtml(html)) throw new Error("حماية AzoraFly تمنع الاتصال (Cloudflare)");
  if (String(html || "").length < 80) throw new Error("تعذر تحميل نتائج البحث");
  return html;
}

async function fetchAzoraJson(path, { searchParams = {}, referer = `${DEFAULT_BASE_URL}/` } = {}) {
  const url = new URL(path, AZORA_API_URL);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }
  const key = url.toString();
  const cached = azoraJsonCache.get(key);
  if (cached && Date.now() - cached.at < AZORA_JSON_TTL_MS) return cached.data;

  const response = await publicFetch(key, {
    headers: {
      accept: "application/json",
      referer,
      "accept-language": "ar,en;q=0.9",
    },
    signal: AbortSignal.timeout(25_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(`AzoraFly API a répondu ${response.status}`);
  azoraJsonCache.set(key, { at: Date.now(), data });
  return data;
}

async function fetchAzoraChapterList(postId, slug) {
  if (!postId) return [];
  try {
    const data = await fetchAzoraJson("/api/chapters", {
      searchParams: {
        postId: String(postId),
        skip: "0",
        take: "all",
        order: "desc",
      },
    });
    return (data.post?.chapters || []).map((chapter) => mapAzoraChapter(slug, chapter));
  } catch {
    return [];
  }
}

function assertAzoraUrl(rawUrl, chapter = false, ctx = DEFAULT_CTX) {
  const url = parseAzoraRequestUrl(rawUrl);
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) throw new Error("المصدر غير مسموح");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "series" || parts.length < (chapter ? 3 : 2)) throw new Error("رابط AzoraFly غير صالح");
  const series = encodeURIComponent(decodeAzoraSlug(parts[1]));
  url.pathname = chapter
    ? "/series/" + series + "/" + encodeURIComponent(decodeAzoraSlug(parts[2]))
    : "/series/" + series;
  url.hash = "";
  return url.toString();
}

function assertAzoraImageUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.hostname !== "storage.azorafly.com") throw new Error("رابط الصورة غير مسموح");
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (url.pathname.includes("..")) throw new Error("رابط الصورة غير مسموح");
  const allowedPath = url.pathname.startsWith("/upload/")
    || url.pathname.startsWith("/public/upload/")
    || url.pathname.startsWith("/WP-manga/")
    || /\.(?:webp|jpe?g|png|avif|gif)$/i.test(url.pathname);
  if (!allowedPath) throw new Error("رابط الصورة غير مسموح");
  return url.toString();
}

async function proxyAzoraImage(rawUrl, ctx = DEFAULT_CTX) {
  const target = assertAzoraImageUrl(rawUrl);
  return fetchNativeImage(target, () => fetchProxiedImage(target, `${ctx.baseUrl}/`, "AzoraFly"));
}

function parseAzoraFilters(html) {
  const categories = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (!/itemprop\s*=\s*["']genre["']/i.test(match[1])) continue;
    const href = decodeHtml(match[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    let genre = "";
    try { genre = new URL(href, DEFAULT_BASE_URL).searchParams.get("genres")?.replace(/^\+/, "") ?? ""; } catch { continue; }
    const name = textOnly(match[2]);
    if (!genre || !name || seen.has(genre)) continue;
    seen.add(genre);
    categories.push({ slug: genre, name, count: 0 });
  }
  return { categories, tags: [] };
}

function decodeAzoraSlug(raw = "") {
  const decoded = decodeHtml(String(raw || ""));
  try { return decodeURIComponent(decoded); } catch { return decoded; }
}

function azoraHtmlSlug(slug) {
  return decodeAzoraSlug(slug)
    .replace(/&/g, "&amp;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;");
}

function azoraSeriesPath(slug, chapterSlug = "") {
  const series = encodeURIComponent(decodeAzoraSlug(slug));
  if (!chapterSlug) return DEFAULT_BASE_URL + "/series/" + series;
  return DEFAULT_BASE_URL + "/series/" + series + "/" + encodeURIComponent(decodeAzoraSlug(chapterSlug));
}

function parseAzoraRequestUrl(rawUrl) {
  return new URL(decodeHtml(String(rawUrl || "").trim()));
}

function azoraSlugFromUrl(rawUrl) {
  const url = parseAzoraRequestUrl(rawUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  const raw = parts[0] === "series" ? (parts[1] || "") : (parts.at(-1) || "");
  return decodeAzoraSlug(raw);
}

function azoraSlugVariants(slug) {
  const decoded = decodeAzoraSlug(slug);
  return [...new Set([slug, decoded, azoraHtmlSlug(decoded), encodeURIComponent(decoded)].filter(Boolean))];
}

function extractAzoraEntityId(html, slug, { parentSlug = "" } = {}) {
  const variants = azoraSlugVariants(slug);
  for (const variant of variants) {
    const escapedSlug = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const slugBound = parentSlug
      ? [
        new RegExp(`&quot;slug&quot;:\\[0,&quot;${escapedSlug}&quot;\\][\\s\\S]{0,240}?&quot;id&quot;:\\[0,(\\d+)\\]`, "i"),
        new RegExp(`"slug":\\[0,"${escapedSlug}"\\][\\s\\S]{0,240}?"id":\\[0,(\\d+)\\]`, "i"),
      ]
      : [
        new RegExp(`&quot;post&quot;:\\[0,\\{&quot;id&quot;:\\[0,(\\d+)\\],&quot;slug&quot;:\\[0,&quot;${escapedSlug}&quot;`, "i"),
        new RegExp(`"post":\\[0,\\{"id":\\[0,(\\d+)\\],"slug":\\[0,"${escapedSlug}"`, "i"),
        new RegExp(`&quot;id&quot;:\\[0,(\\d+)\\],&quot;slug&quot;:\\[0,&quot;${escapedSlug}&quot;`, "i"),
        new RegExp(`"id":\\[0,(\\d+)\\],"slug":\\[0,"${escapedSlug}"`, "i"),
      ];
    for (const pattern of slugBound) {
      const match = html.match(pattern)?.[1];
      if (match) return Number(match);
    }
  }

  for (const match of html.matchAll(/&quot;id&quot;:\[0,(\d+)\],&quot;slug&quot;:\[0,&quot;(.*?)&quot;/gi)) {
    if (decodeAzoraSlug(match[2]) === decodeAzoraSlug(slug)) return Number(match[1]);
  }
  for (const match of html.matchAll(/"id":\[0,(\d+)\],"slug":\[0,"(.*?)"/gi)) {
    if (decodeAzoraSlug(match[2]) === decodeAzoraSlug(slug)) return Number(match[1]);
  }

  if (!parentSlug) {
    for (const pattern of [
      /&quot;postId&quot;:\[0,(\d+)\]/i,
      /"postId":\[0,(\d+)\]/,
    ]) {
      const match = html.match(pattern)?.[1];
      if (match) return Number(match);
    }
  }

  return 0;
}

export function extractAzoraPostId(html, slug) {
  return extractAzoraEntityId(html, slug);
}

export function extractAzoraChapterId(html, chapterSlug) {
  return extractAzoraEntityId(html, chapterSlug, { parentSlug: true });
}

export function parseAzoraCatalog(html) {
  const results = [];
  const seen = new Set();
  const marker = /<div><div class="relative h-full p-1 sm:p-2 flex gap-2 sm:gap-4 rounded-xl border bg-card/gi;
  const starts = [...html.matchAll(marker)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const link = block.match(/<a[^>]*href=(["'])([^"']+)\1[^>]*title=(["'])([\s\S]*?)\3/i);
    if (!link) return;
    const href = decodeHtml(link[2]);
    const slug = decodeAzoraSlug(href.match(/\/series\/([^/?#]+)/i)?.[1] ?? "");
    if (!slug || seen.has(slug)) return;
    const title = decodeHtml(link[4]);
    const cover = block.match(/<img[^>]*alt="[^"]*"[^>]*(?:src|data-src)="([^"]+)"/i)?.[1]
      ?? block.match(/<img[^>]*(?:src|data-src)="([^"]+)"[^>]*alt="[^"]*"/i)?.[1]
      ?? "";
    const mediaType = textOnly(block.match(/text-white[^>]*>([^<]+)<\/span>/i)?.[1] ?? "مانهوا");
    const chapters = normalizeRecentChapters([...block.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap((entry) => {
      const chapterHref = decodeHtml(entry[1] || "");
      const pathMatch = chapterHref.match(/\/series\/([^/?#]+)\/([^/?#]+)/i);
      if (!pathMatch || decodeAzoraSlug(pathMatch[1]) !== slug) return [];
      const inner = entry[2] || "";
      const labelMatch = inner.match(/<span>([^<]*الفصل[^<]*)<\/span>/i);
      if (!labelMatch) return [];
      const name = textOnly(labelMatch[1]).replace(/^الفصل\s*/i, "");
      return [{
        url: azoraSeriesPath(slug, pathMatch[2]),
        name,
        number: name,
        locked: /lucide-lock|مقفل|مدفوع|locked/i.test(inner),
        unlockAt: extractAzoraUnlockAt(inner),
      }];
    }));
    seen.add(slug);
    results.push(applyRecentChapterFields({
      id: slug,
      title,
      url: azoraSeriesPath(slug),
      cover,
      source: "AzoraFly",
      sourceId: "azorafly",
      mediaType: /رواية/.test(mediaType) ? "novel" : "manga",
      mediaTypeLabel: mediaType || "مانهوا",
    }, chapters));
  });
  return results;
}

function normalizeAzoraUnlockAt(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

export function extractAzoraUnlockAt(html = "") {
  if (!html) return null;
  const encoded = html.match(/&quot;unlockAt&quot;\s*:\s*(?:\[0\s*,\s*)?(?:&quot;([^&]+)&quot;|null)/i);
  const plain = html.match(/"unlockAt"\s*:\s*(?:\[0\s*,\s*)?(?:"([^"]+)"|null)/i);
  return normalizeAzoraUnlockAt(encoded?.[1] || plain?.[1] || "");
}

function mapAzoraChapter(slug, chapter) {
  return {
    url: azoraSeriesPath(slug, chapter.slug),
    name: `${chapter.number}${chapter.title ? ` · ${chapter.title}` : ""}`,
    number: String(chapter.number),
    date: chapter.createdAt ? new Date(chapter.createdAt).toLocaleDateString("ar-EG") : "",
    publishedAt: chapter.createdAt || null,
    locked: chapter.isAccessible === false || chapter.isLocked === true,
    chapterId: chapter.id,
    price: chapter.price || 0,
    permanentlyLocked: Boolean(chapter.isPermanentlyLocked),
    unlockAt: normalizeAzoraUnlockAt(chapter.unlockAt || ""),
  };
}

function parseAzoraChaptersFromHtml(html, slug) {
  const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linkPattern = new RegExp(
    `<a[^>]+href=["']/series/${escapedSlug}/([^"']+)["'][^>]*>([\\s\\S]*?)</a>`,
    "gi",
  );
  const chapters = [];
  const seen = new Set();

  for (const match of html.matchAll(linkPattern)) {
    const chapterSlug = match[1];
    if (!chapterSlug.startsWith("chapter-") || seen.has(chapterSlug)) continue;
    seen.add(chapterSlug);
    const block = match[0];
    const label = textOnly(match[2]);
    const number = chapterSlug.replace(/^chapter-/, "");
    chapters.push({
      url: azoraSeriesPath(slug, chapterSlug),
      name: label || number,
      number,
      date: "",
      locked: /lucide-lock|مقفل|مدفوع|locked/i.test(block),
      unlockAt: extractAzoraUnlockAt(block),
    });
  }

  return chapters;
}

function normalizeAzoraImageUrl(raw) {
  const cleaned = raw
    .replace(/\\+/g, "")
    .replace(/&(quot|amp|#39);.*$/i, "")
    .replace(/["'<>].*$/, "")
    .trim();

  try {
    const url = new URL(cleaned);
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    return url.toString();
  } catch {
    return cleaned.replace(/\/public\/\/+upload\//, "/public/upload/");
  }
}

function compareAzoraPages(left, right) {
  const leftPage = Number(left.src.match(/\/(\d{1,4})\.(?:webp|jpe?g|png|avif)$/i)?.[1])
    || Number(left.src.match(/page-(\d+)/i)?.[1])
    || Number(left.order)
    || 0;
  const rightPage = Number(right.src.match(/\/(\d{1,4})\.(?:webp|jpe?g|png|avif)$/i)?.[1])
    || Number(right.src.match(/page-(\d+)/i)?.[1])
    || Number(right.order)
    || 0;
  return leftPage - rightPage;
}

function mapAzoraApiPages(rawPages = [], title = "") {
  const pages = [];
  const seen = new Set();
  for (const [index, page] of rawPages.entries()) {
    const src = normalizeAzoraImageUrl(
      page?.url || page?.src || page?.imageUrl || page?.path || page?.image || "",
    );
    if (!src || seen.has(src)) continue;
    if (!/\/(?:upload\/series\/|WP-manga\/data\/|\.(?:webp|jpe?g|png|avif)$)/i.test(src)) continue;
    seen.add(src);
    pages.push({
      src,
      alt: `${title} · ${pages.length + 1}`,
      order: Number(page?.order ?? page?.pageNumber ?? index + 1),
    });
  }
  pages.sort(compareAzoraPages);
  return pages;
}

export function extractAzoraChapterPages(html, seriesSlug, title) {
  const escapedSlug = seriesSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const storageBase = "https://storage\\.azorafly\\.com/(?:public/+)?upload/series/";
  const pageFilePattern = "(?:page-[^\"'\\s<>]+|\\d{1,4}\\.(?:webp|jpe?g|png|avif))";
  const wpMangaPattern = "https://storage\\.azorafly\\.com/WP-manga/data/manga_[a-f0-9]+/[a-f0-9]+/\\d{1,4}\\.(?:webp|jpe?g|png|avif)";
  const patterns = [
    new RegExp(wpMangaPattern, "gi"),
    new RegExp(`${storageBase}${escapedSlug}/[^"'\\s<>]+/${pageFilePattern}`, "gi"),
    new RegExp(`<img[^>]+src=["'](${storageBase}${escapedSlug}/[^"']+)["']`, "gi"),
    new RegExp(`${storageBase}[^"'\\s<>]+/${pageFilePattern}`, "gi"),
  ];
  const seen = new Set();
  const pages = [];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const src = normalizeAzoraImageUrl(match[1] || match[0]);
      if (!src || seen.has(src)) continue;
      if (!/\/(?:page-|\d{1,4}\.(?:webp|jpe?g|png|avif)$)/i.test(src)) continue;
      if (!/\/(?:upload\/series\/|WP-manga\/data\/)/i.test(src)) continue;
      seen.add(src);
      pages.push({ src, alt: `${title} · ${pages.length + 1}` });
    }
    if (pages.length) break;
  }

  pages.sort(compareAzoraPages);
  return pages;
}

function isAzoraPaywalledChapter(html, pages, apiChapter = null) {
  if (pages.length) return false;
  if (apiChapter) {
    const locked = apiChapter.isAccessible === false || apiChapter.isLocked === true;
    if (locked) return true;
  }
  const inaccessible = /&quot;isAccessible&quot;:\[0,false\]|"isAccessible"\s*:\s*(?:\[0,false\]|false)/.test(html);
  const locked = /&quot;isLocked&quot;:\[0,true\]|"isLocked"\s*:\s*(?:\[0,true\]|true)/.test(html);
  const zeroPages = /\u064a\u062a\u0636\u0645\u0646 0 \u0635\u0641\u062d\u0629 \u0643\u0648\u0645\u064a\u0643/.test(html);
  return (inaccessible && locked) || zeroPages;
}

async function fetchAzoraChapterPayload(chapterId) {
  if (!chapterId) return null;
  for (const path of [`/api/chapters/${chapterId}/pages`, `/api/chapters/${chapterId}`]) {
    try {
      const data = await fetchAzoraJson(path);
      const chapter = data.chapter || data.post || data;
      if (!chapter || typeof chapter !== "object") continue;
      return { chapter, pages: chapter.pages || chapter.images || data.pages || [] };
    } catch {
      // Essayer le point d’entrée API suivant.
    }
  }
  return null;
}

function parseAzoraNovelParagraphs(raw = "") {
  if (!raw) return [];
  if (/<(?:p|h[1-6]|div)\b/i.test(raw)) {
    return filterNovelParagraphs([...raw.matchAll(/<(?:p|h[1-6])[^>]*>([\s\S]*?)<\/(?:p|h[1-6])>/gi)]
      .map((match) => textOnly(match[1]))
      .filter(Boolean));
  }
  return filterNovelParagraphs(raw.split(/\n{2,}/).map((entry) => textOnly(entry)).filter(Boolean));
}

async function parseAzoraDetails(html, url, ctx = DEFAULT_CTX) {
  const slug = azoraSlugFromUrl(url);
  const postId = extractAzoraPostId(html, slug);
  const chaptersPromise = fetchAzoraChapterList(postId, slug);

  const title = decodeHtml(html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1] ?? slug);
  const cover = html.match(/<img[^>]*alt="Cover of [^"]*"[^>]*src="(https:\/\/storage\.azorafly\.com[^"]+)"/i)?.[1]
    ?? html.match(/<meta property="og:image" content="(https:\/\/storage\.azorafly\.com[^"]+)"/i)?.[1]
    ?? "";
  const description = decodeHtml(html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? "");
  const summary = textOnly(description);
  const typeBlock = html.match(/class="lucide lucide-type[\s\S]{0,900}?text-foreground[^>]*>([^<]+)<\/span>/i)?.[1] ?? "مانهوا";
  const mediaType = /رواية/.test(typeBlock) ? "novel" : "manga";
  const taxonomies = parseDetailTaxonomies(html, ctx.baseUrl);

  let chapters = await chaptersPromise;
  if (!chapters.length) chapters = parseAzoraChaptersFromHtml(html, slug);

  return enrichSourceDetails({
    id: slug,
    title,
    altTitle: "",
    cover,
    summary,
    url,
    source: "AzoraFly",
    sourceId: "azorafly",
    mediaType,
    mediaTypeLabel: mediaType === "novel" ? "رواية" : textOnly(typeBlock),
    ...taxonomies,
    chapters,
  }, { html, parser: "badges" });
}

async function resolveAzoraDetails(url, ctx, fetchAzoraHtml) {
  const html = await resolveAzoraHtml(url, fetchAzoraHtml);
  return parseAzoraDetails(html, url, ctx);
}

export function parseAzoraChapter(html, url, apiPayload = null) {
  const parts = parseAzoraRequestUrl(url).pathname.split("/").filter(Boolean);
  const seriesSlug = decodeAzoraSlug(parts[1] || "");
  const chapterSlug = decodeAzoraSlug(parts[2] || "");
  const title = decodeHtml(
    html.match(/<meta name="twitter:title" content="([^"]+)"/i)?.[1]
    ?? html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]
    ?? "",
  );

  const apiChapter = apiPayload?.chapter || null;
  const apiNovel = apiChapter?.content || apiChapter?.text || apiChapter?.body || "";
  if (apiNovel) {
    const paragraphs = parseAzoraNovelParagraphs(String(apiNovel));
    if (paragraphs.length) {
      return {
        title,
        url,
        kind: "novel",
        paragraphs,
        pages: [],
        locked: apiChapter?.isAccessible === false || apiChapter?.isLocked === true,
        unlockAt: normalizeAzoraUnlockAt(apiChapter?.unlockAt || extractAzoraUnlockAt(html)),
      };
    }
  }

  const novelBlock = html.match(/<div class="novel-reader-content[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  if (novelBlock) {
    const paragraphs = filterNovelParagraphs([...novelBlock.matchAll(/<(?:p|h[1-6])[^>]*>([\s\S]*?)<\/(?:p|h[1-6])>/gi)]
      .map((match) => textOnly(match[1]))
      .filter(Boolean));
    return {
      title,
      url,
      kind: "novel",
      paragraphs,
      pages: [],
      locked: false,
      unlockAt: extractAzoraUnlockAt(html),
    };
  }

  const pages = mapAzoraApiPages(apiPayload?.pages || [], title);
  const htmlPages = pages.length ? pages : extractAzoraChapterPages(html, seriesSlug, title);
  const locked = isAzoraPaywalledChapter(html, htmlPages, apiChapter);

  return {
    title,
    url,
    kind: "manga",
    pages: htmlPages,
    paragraphs: [],
    locked,
    unlockAt: normalizeAzoraUnlockAt(apiChapter?.unlockAt || extractAzoraUnlockAt(html)),
    paywallMessage: locked ? "هذا الفصل مدفوع على AzoraFly ولا يمكن قراءته هنا." : "",
    chapterId: apiChapter?.id || extractAzoraChapterId(html, chapterSlug) || null,
  };
}

async function resolveAzoraChapter(url, fetchAzoraHtml) {
  const parts = parseAzoraRequestUrl(url).pathname.split("/").filter(Boolean);
  const chapterSlug = decodeAzoraSlug(parts[2] || "");
  const html = await resolveAzoraHtml(url, fetchAzoraHtml);
  const chapterId = extractAzoraChapterId(html, chapterSlug);

  if (chapterId) {
    const apiPayload = await fetchAzoraChapterPayload(chapterId);
    const fromApi = parseAzoraChapter(html, url, apiPayload);
    if (fromApi.pages.length || fromApi.paragraphs.length) return fromApi;
    if (fromApi.locked) return fromApi;
  }

  const chapter = parseAzoraChapter(html, url);
  if (chapter.pages.length || chapter.paragraphs.length) return chapter;

  await bustAzoraHtmlCache(url);
  const retryHtml = await resolveAzoraHtml(`${url}${url.includes("?") ? "&" : "?"}_ts=${Date.now()}`, fetchAzoraHtml);
  const retryChapter = parseAzoraChapter(retryHtml, url);
  if (retryChapter.pages.length || retryChapter.paragraphs.length) return retryChapter;
  if (retryChapter.locked) return retryChapter;

  throw new Error("تعذر استخراج صفحات فصل AzoraFly، أعد المحاولة");
}

async function fetchAzoraFilters(ctx, fetchAzoraHtml) {
  const cacheKey = ctx.baseUrl;
  const cached = azoraFiltersCache.get(cacheKey);
  if (cached && Date.now() - cached.at < FILTERS_CACHE_TTL_MS) return cached.data;

  const html = await resolveAzoraHtml(`${ctx.baseUrl}/series/`, fetchAzoraHtml);
  const data = {
    ...mergeFilterGroups([
      parseAzoraFilters(html),
      parseTaxonomyFilterLinks(html, ctx.baseUrl, [ctx.apex, ctx.hostname]),
    ]),
    fetchedAt: new Date().toISOString(),
  };
  azoraFiltersCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

async function fetchAzoraCatalogPage(ctx, fetchAzoraHtml, { page = 1, genre = "" } = {}) {
  const genreQuery = genre ? `&genres=${encodeURIComponent(`+${genre}`)}` : "";
  const offset = (page - 1) * APP_PAGE_SIZE;
  const upstreamPage = Math.floor(offset / UPSTREAM_PAGE_SIZE) + 1;
  const start = offset % UPSTREAM_PAGE_SIZE;
  const page1Url = `${ctx.baseUrl}/series/?page=${upstreamPage}${genreQuery}`;
  const page2Url = `${ctx.baseUrl}/series/?page=${upstreamPage + 1}${genreQuery}`;
  const needsSpill = start + APP_PAGE_SIZE > UPSTREAM_PAGE_SIZE;

  const [html1, html2] = await Promise.all([
    resolveAzoraHtml(page1Url, fetchAzoraHtml),
    needsSpill ? resolveAzoraHtml(page2Url, fetchAzoraHtml).catch(() => "") : Promise.resolve(""),
  ]);

  let pool = parseAzoraCatalog(html1);
  if (needsSpill && html2 && pool.length >= UPSTREAM_PAGE_SIZE) {
    pool = pool.concat(parseAzoraCatalog(html2));
  }

  const items = pool.slice(start, start + APP_PAGE_SIZE);
  return {
    items,
    page,
    genre,
    hasMore: items.length === APP_PAGE_SIZE,
    fetchedAt: new Date().toISOString(),
  };
}

export async function handleAzoraRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: "AzoraFly" });
  const fetchAzoraHtml = createFetcher(ctx.baseUrl);

  if (requestUrl.pathname.endsWith("/image")) {
    return await proxyAzoraImage(requestUrl.searchParams.get("url") ?? "", ctx);
  }
  if (requestUrl.pathname.endsWith("/filters")) {
    return responseJson(200, await fetchAzoraFilters(ctx, fetchAzoraHtml));
  }
  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() ?? "";
    if (genre && !/^\d+$/.test(genre)) throw new Error("تصنيف AzoraFly غير صالح");
    return responseJson(200, await fetchAzoraCatalogPage(ctx, fetchAzoraHtml, { page, genre }));
  }
  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const genre = requestUrl.searchParams.get("genre")?.trim() ?? "";
    if (genre && !/^\d+$/.test(genre)) throw new Error("تصنيف AzoraFly غير صالح");
    if (genre) {
      const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
      const payload = await fetchAzoraCatalogPage(ctx, fetchAzoraHtml, { page, genre });
      const needle = query.toLocaleLowerCase("ar");
      const items = payload.items.filter((item) => (
        `${item.title || ""} ${item.altTitle || ""}`.toLocaleLowerCase("ar").includes(needle)
      ));
      return responseJson(200, {
        items,
        page,
        genre,
        hasMore: payload.hasMore,
        fetchedAt: payload.fetchedAt,
      });
    }
    const genreQuery = "";
    const html = await resolveAzoraSearchHtml(
      `${ctx.baseUrl}/series/?searchTerm=${encodeURIComponent(query)}${genreQuery}`,
      fetchAzoraHtml,
    );
    return responseJson(200, { items: parseAzoraCatalog(html).slice(0, 40) });
  }
  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertAzoraUrl(requestUrl.searchParams.get("url") ?? "", false, ctx);
    return responseJson(200, await resolveAzoraDetails(target, ctx, fetchAzoraHtml));
  }
  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertAzoraUrl(requestUrl.searchParams.get("url") ?? "", true, ctx);
    return responseJson(200, await resolveAzoraChapter(target, fetchAzoraHtml));
  }
  return responseJson(404, { error: "Route AzoraFly inconnue" });
}
