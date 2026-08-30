import { decodeHtml, parseDetailTaxonomies, textOnly } from "../lib/htmlUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, normalizeRecentChapters } from "../lib/catalogChapters.js";
import { enrichChapterDates, parseChapterDateString } from "../lib/chapterDates.js";
import { extractChapterNumber, normalizeChapterList } from "../lib/chapterOrdering.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { isCloudflareChallengeHtml } from "../lib/cloudflareDetect.js";
import {
  configureSourceNativeFetch,
  fetchNativeHtml,
  fetchNativeImage,
  hasNativeHtmlFetcher,
} from "../lib/nativeFetchBridge.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";

const DEFAULT_BASE_URL = "https://manhwaread.com";
const SOURCE_NAME = "ManhwaRead";
const SOURCE_ID = "manhwaread";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
const ALLOWED_APEX_HOSTS = ["manhwaread.com", "manhwaread.org", "mgread.io"];
const HOST_PATTERN = /^(?:www\.)?(?:manhwaread\.(?:com|org)|mgread\.io)$/i;
const IMAGE_HOST_PATTERN = /^(?:(?:www\.)?(?:manhwaread\.(?:com|org)|mgread\.io)|(?:[\w-]+\.)?(?:mancover|manread)\.xyz)$/i;
const SERIES_PREFIX = "manhwa";
const FILTER_SLUG_PATTERN = /^[\p{L}\p{N}+_-]+$/u;
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function mirrorHostVariants(url) {
  try {
    const parsed = new URL(url);
    const hosts = new Set([parsed.hostname]);
    for (const apex of ALLOWED_APEX_HOSTS) {
      hosts.add(apex);
      hosts.add(`www.${apex}`);
    }
    return [...hosts].map((host) => {
      const next = new URL(url);
      next.hostname = host;
      return next.toString();
    });
  } catch {
    return [url];
  }
}

function htmlLooksValid(html = "") {
  if (!html || isCloudflareChallengeHtml(html)) return false;
  return /manga-item|chaptersList|chapter-item|mangaSummary|chapterData|manga-desc__content/i.test(html);
}

function createFetcher(baseUrl = DEFAULT_BASE_URL) {
  return createCachedHtmlFetcher({
    ttlMs: 3 * 60_000,
    timeoutMs: 45_000,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en,ar;q=0.8",
      referer: `${baseUrl}/`,
      "user-agent": BROWSER_UA,
    },
    getVariants: mirrorHostVariants,
    buildError: (lastStatus) => (lastStatus === 403
      ? "حماية ManhwaRead منعت الاتصال مؤقتًا"
      : `ManhwaRead a répondu ${lastStatus || "sans réponse"}`),
    preferFlareSolverr: true,
  });
}

export function configureManhwareadNativeFetch(options) {
  configureSourceNativeFetch(options);
}

async function resolveHtml(url, fetchHtmlRemote) {
  if (hasNativeHtmlFetcher()) {
    try {
      const nativeHtml = await fetchNativeHtml(url, async () => "");
      if (htmlLooksValid(nativeHtml)) return nativeHtml;
    } catch {
      // Fall through to Flare / HTTP variants.
    }
  }
  const html = await fetchHtmlRemote(url);
  if (isCloudflareChallengeHtml(html)) {
    throw new Error("حماية ManhwaRead منعت الاتصال (Cloudflare)");
  }
  return html;
}

function normalizeSiteUrl(rawUrl = "", ctx = DEFAULT_CTX, { chapter = false } = {}) {
  try {
    const url = new URL(decodeHtml(String(rawUrl || "")).trim(), ctx.baseUrl);
    if (url.protocol !== "https:" || !HOST_PATTERN.test(url.hostname)) return "";
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== SERIES_PREFIX || parts.length < (chapter ? 3 : 2)) return "";
    if (!chapter && parts.length !== 2) return "";
    url.hostname = ctx.apex;
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function assertManhwareadUrl(rawUrl, ctx = DEFAULT_CTX, chapter = false) {
  const normalized = normalizeSiteUrl(rawUrl, ctx, { chapter });
  if (!normalized) throw new Error(chapter ? "رابط فصل ManhwaRead غير صالح" : "رابط ManhwaRead غير صالح");
  return normalized;
}

function normalizeAssetUrl(rawUrl = "", ctx = DEFAULT_CTX) {
  const cleaned = decodeHtml(String(rawUrl || "")).replace(/\s+/g, "").trim();
  if (!cleaned || /^data:/i.test(cleaned)) return "";
  try {
    const url = new URL(cleaned, ctx.baseUrl);
    if (url.protocol !== "https:" || !IMAGE_HOST_PATTERN.test(url.hostname)) return "";
    url.hash = "";
    if (HOST_PATTERN.test(url.hostname)) url.hostname = ctx.apex;
    const path = url.pathname;
    const allowedPath = path.startsWith("/cover/")
      || path.startsWith("/wp-content/")
      || /^\/\d+\//.test(path)
      || /\.(?:webp|jpe?g|png|avif|gif)$/i.test(path);
    if (!allowedPath) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function assertManhwareadImageUrl(rawUrl, ctx = DEFAULT_CTX) {
  const normalized = normalizeAssetUrl(rawUrl, ctx);
  if (!normalized) throw new Error("رابط الصورة غير مسموح");
  return normalized;
}

function imageFromTag(tag = "", ctx = DEFAULT_CTX) {
  for (const attr of ["data-src", "data-lazy-src", "data-original", "src"]) {
    const value = tag.match(new RegExp(`(?:^|[\\s"])${attr}=["']([^"']+)["']`, "i"))?.[1] ?? "";
    const normalized = normalizeAssetUrl(value, ctx);
    if (normalized) return normalized;
  }
  return "";
}

function assertFilterSlug(value, label) {
  const slug = String(value || "").trim();
  if (!slug) return "";
  if (!FILTER_SLUG_PATTERN.test(slug)) throw new Error(label);
  return slug;
}

function parseLooseCount(raw = "") {
  const match = String(raw).replace(/,/g, "").match(/([\d.]+)\s*([kKmM])?\s*$/);
  if (!match) return 0;
  let value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  if (/k/i.test(match[2] || "")) value *= 1_000;
  if (/m/i.test(match[2] || "")) value *= 1_000_000;
  return Math.round(value);
}

function decodeBase64Json(encoded = "") {
  const padded = String(encoded) + "=".repeat((4 - (String(encoded).length % 4)) % 4);
  const text = typeof Buffer !== "undefined"
    ? Buffer.from(padded, "base64").toString("utf8")
    : atob(padded);
  return JSON.parse(text);
}

export function extractManhwareadChapterImages(html = "", ctx = DEFAULT_CTX) {
  const match = String(html).match(/var\s+chapterData\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return [];
  try {
    const payload = JSON.parse(match[1]);
    const base = String(payload.base || "").replace(/\/+$/, "");
    const pages = decodeBase64Json(payload.data || "");
    if (!base || !Array.isArray(pages)) return [];
    const results = [];
    for (const entry of pages) {
      const src = String(entry?.src || "").replace(/\\\//g, "/").trim();
      if (!src) continue;
      const absolute = `${base}/${src.replace(/^\/+/, "")}`;
      const normalized = normalizeAssetUrl(absolute, ctx);
      if (normalized && !results.some((page) => page.src === normalized)) {
        results.push({ src: normalized, alt: "" });
      }
    }
    return results;
  } catch {
    return [];
  }
}

function isMangaItemCard(tagAttrs = "") {
  const classes = tagAttrs.match(/class=["']([^"']+)["']/i)?.[1] ?? "";
  return /(^|\s)manga-item(\s|$)/.test(classes);
}

function parseCatalogCards(html = "", ctx = DEFAULT_CTX) {
  const results = [];
  const seen = new Set();
  const starts = [...html.matchAll(/<div\b([^>]*)>/gi)].filter((match) => isMangaItemCard(match[1]));
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const href = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["']/i)?.[1]
      ?? block.match(/<a[^>]*href=["']([^"']*\/manhwa\/[^"']+)["'][^>]*class=["'][^"']*btn/i)?.[1]
      ?? block.match(/<a[^>]*href=["']([^"']*\/manhwa\/[^"']+)["']/i)?.[1]
      ?? "";
    const url = normalizeSiteUrl(href, ctx);
    if (!url || seen.has(url)) return;
    const title = textOnly(
      block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
      ?? block.match(/<img[^>]*alt=["']([^"']+)["']/i)?.[1]
      ?? "",
    );
    if (!title) return;
    const imageTag = block.match(/<div[^>]*class="[^"]*manga-item__img[^"]*"[^>]*>[\s\S]*?<img[^>]*>/i)?.[0]
      ?? block.match(/<img[^>]*class="[^"]*manga-item__img-inner[^"]*"[^>]*>/i)?.[0]
      ?? block.match(/<img[^>]*>/i)?.[0]
      ?? "";
    const cover = imageFromTag(imageTag, ctx);
    const seriesSlug = new URL(url).pathname.split("/").filter(Boolean)[1] || "";
    const chapters = normalizeRecentChapters([...block.matchAll(/href=["']([^"']*\/manhwa\/[^"']+\/chapter-[^"']+)["'][^>]*>[\s\S]*?(?:chapter-item__name[^>]*>)?([\s\S]*?)<\//gi)].map((entry) => {
      const chapterUrl = normalizeSiteUrl(entry[1], ctx, { chapter: true });
      if (!chapterUrl || (seriesSlug && !chapterUrl.includes(`/manhwa/${seriesSlug}/`))) return null;
      const name = textOnly(entry[2]).replace(/^(?:Chapter|الفصل)\s*/i, "");
      return { url: chapterUrl, name, number: name };
    }).filter(Boolean));
    seen.add(url);
    results.push(applyRecentChapterFields({
      id: seriesSlug,
      title,
      url,
      cover,
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType: "manga",
      mediaTypeLabel: "مانهوا",
    }, chapters));
  });
  return results;
}

export function parseManhwareadCatalog(html = "", ctx = DEFAULT_CTX) {
  return parseCatalogCards(html, ctx);
}

export function parseManhwareadChapters(html = "", ctx = DEFAULT_CTX, seriesUrl = "") {
  const seriesSlug = (() => {
    try {
      return new URL(seriesUrl || "").pathname.split("/").filter(Boolean)[1] || "";
    } catch {
      return "";
    }
  })();
  const holder = html.match(/id=["']chaptersList["'][\s\S]*?(?=<div[^>]*id=["'](?!chaptersList)|<\/main>|$)/i)?.[0] || html;
  const chapters = [];
  const seen = new Set();
  for (const match of holder.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (!/chapter-item/i.test(match[1])) continue;
    const href = match[1].match(/href=["']([^"']+)["']/i)?.[1] ?? "";
    const url = normalizeSiteUrl(href, ctx, { chapter: true });
    if (!url || seen.has(url)) continue;
    if (seriesSlug && !url.includes(`/manhwa/${seriesSlug}/`)) continue;
    const name = textOnly(match[2].match(/chapter-item__name[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? match[2]);
    const date = textOnly(match[2].match(/chapter-item__date[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const number = extractChapterNumber(name, url) || name.replace(/^(?:Chapter|الفصل)\s*/i, "").trim();
    const publishedAt = parseChapterDateString(date);
    seen.add(url);
    chapters.push({
      url,
      name,
      number,
      date,
      ...(publishedAt ? { publishedAt } : {}),
    });
  }
  // Le site liste du plus ancien au plus récent.
  return enrichChapterDates(normalizeChapterList(chapters.reverse()));
}

function parseManga(html, url, ctx = DEFAULT_CTX) {
  const summary = html.match(/id=["']mangaSummary["'][\s\S]{0,12000}/i)?.[0] || html;
  const title = textOnly(
    summary.match(/manga-titles[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? summary.match(/<h1[^>]*class=["'][^"']*clipboard-copy[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? html.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]
    ?? "",
  );
  const cover = normalizeAssetUrl(
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1]
    ?? summary.match(/<img[^>]*(?:src|data-src)=["']([^"']+)["']/i)?.[1]
    ?? "",
    ctx,
  );
  const summaryText = textOnly(html.match(/manga-desc__content[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const statusRaw = summary.match(/manga-status[^>]*data-status=["']([^"']+)["']/i)?.[1] || "";
  const publicationStatus = /complet/i.test(statusRaw) ? "completed"
    : /ongoing|on-going/i.test(statusRaw) ? "ongoing"
      : /hold|hiatus/i.test(statusRaw) ? "hiatus"
        : statusRaw || "";
  const taxonomies = parseDetailTaxonomies(html, ctx.baseUrl);
  const chapters = parseManhwareadChapters(html, ctx, url);
  return enrichSourceDetails({
    id: new URL(url).pathname.split("/").filter(Boolean).pop(),
    title,
    cover,
    summary: summaryText,
    url,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "manga",
    mediaTypeLabel: "مانهوا",
    publicationStatus,
    ...taxonomies,
    chapters,
  }, { html, parser: "manhwaread" });
}

export function parseManhwareadChapter(html, url, ctx = DEFAULT_CTX) {
  const title = textOnly(
    html.match(/<h1[^>]*id=["']chapter-heading["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? html.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]
    ?? "",
  );
  let pages = extractManhwareadChapterImages(html, ctx);
  if (!pages.length) {
    for (const tag of html.matchAll(/<(?:div[^>]*reading-content|div[^>]*id=["']chapter-images["'])[\s\S]*?<\/div>/gi)) {
      for (const img of tag[0].matchAll(/<img[^>]*>/gi)) {
        const src = imageFromTag(img[0], ctx);
        if (src && !pages.some((page) => page.src === src)) pages.push({ src, alt: title });
      }
    }
  }
  return { title, url, pages };
}

function parseGenreIndex(html = "") {
  const genres = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]*href=["']([^"']*\/genre\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let target;
    try { target = new URL(match[1], DEFAULT_BASE_URL); } catch { continue; }
    if (!HOST_PATTERN.test(target.hostname)) continue;
    const slug = decodeURIComponent(target.pathname.split("/").filter(Boolean).pop() || "").trim();
    const label = textOnly(match[2]);
    const name = label.replace(/[\d.,]+\s*[kKmM]?\s*$/, "").trim();
    if (!slug || !name || seen.has(slug)) continue;
    seen.add(slug);
    genres.push({ slug, name, count: parseLooseCount(label) });
  }
  return genres.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "en"));
}

function parseTagIndex(html = "") {
  const tags = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]*href=["']([^"']*\/tag\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let target;
    try { target = new URL(match[1], DEFAULT_BASE_URL); } catch { continue; }
    if (!HOST_PATTERN.test(target.hostname)) continue;
    const slug = decodeURIComponent(target.pathname.split("/").filter(Boolean).pop() || "").trim();
    const label = textOnly(match[2]);
    const name = label.replace(/[\d.,]+\s*[kKmM]?\s*$/, "").trim();
    if (!slug || !name || seen.has(slug)) continue;
    seen.add(slug);
    tags.push({ slug, name, count: parseLooseCount(label), archivePath: "tag" });
  }
  return tags.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "en"));
}

function catalogTarget(ctx, { page = 1, genre = "", tag = "" } = {}) {
  const basePath = genre
    ? `/genre/${encodeURIComponent(genre)}`
    : tag
      ? `/tag/${encodeURIComponent(tag)}`
      : `/${SERIES_PREFIX}`;
  return page === 1 ? `${ctx.baseUrl}${basePath}/` : `${ctx.baseUrl}${basePath}/page/${page}/`;
}

export async function handleManhwareadRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, {
    label: SOURCE_NAME,
    allowedApexHosts: ALLOWED_APEX_HOSTS,
  });
  const fetchHtmlRemote = createFetcher(ctx.baseUrl);
  const fetchHtml = (url) => resolveHtml(url, fetchHtmlRemote);

  if (requestUrl.pathname.endsWith("/image")) {
    const target = assertManhwareadImageUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    return fetchNativeImage(target, () => fetchProxiedImage(target, `${ctx.baseUrl}/`, SOURCE_NAME));
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const [genresHtml, tagsHtml] = await Promise.all([
      fetchHtml(`${ctx.baseUrl}/genre-index/`),
      fetchHtml(`${ctx.baseUrl}/tag-index/`).catch(() => ""),
    ]);
    return responseJson(200, {
      categories: parseGenreIndex(genresHtml),
      tags: tagsHtml ? parseTagIndex(tagsHtml) : [],
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = assertFilterSlug(requestUrl.searchParams.get("genre"), "تصنيف ManhwaRead غير صالح");
    const tag = assertFilterSlug(requestUrl.searchParams.get("tag"), "وسم ManhwaRead غير صالح");
    if (genre && tag) throw new Error("اختر تصنيفًا أو وسمًا واحدًا");
    const target = catalogTarget(ctx, { page, genre, tag });
    const html = await fetchHtml(target);
    const items = parseManhwareadCatalog(html, ctx);
    const nextPath = genre
      ? `/genre/${encodeURIComponent(genre)}/page/${page + 1}/`
      : tag
        ? `/tag/${encodeURIComponent(tag)}/page/${page + 1}/`
        : `/${SERIES_PREFIX}/page/${page + 1}/`;
    return responseJson(200, {
      items,
      page,
      genre,
      tag,
      hasMore: html.includes(nextPath) || html.includes(encodeURI(nextPath)) || /wp-pagenavi[\s\S]*class=["'][^"']*next/i.test(html),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = assertFilterSlug(requestUrl.searchParams.get("genre"), "تصنيف ManhwaRead غير صالح");
    const tag = assertFilterSlug(requestUrl.searchParams.get("tag"), "وسم ManhwaRead غير صالح");
    if (genre || tag) {
      const target = catalogTarget(ctx, { page, genre, tag });
      const html = await fetchHtml(target);
      const needle = query.toLocaleLowerCase("en");
      const items = parseManhwareadCatalog(html, ctx).filter((item) => (
        item.title.toLocaleLowerCase("en").includes(needle)
      ));
      return responseJson(200, { items, page, hasMore: false });
    }
    const searchUrl = page === 1
      ? `${ctx.baseUrl}/?s=${encodeURIComponent(query)}`
      : `${ctx.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}`;
    const html = await fetchHtml(searchUrl);
    return responseJson(200, {
      items: parseManhwareadCatalog(html, ctx).slice(0, 40),
      page,
      hasMore: html.includes(`/page/${page + 1}/`),
    });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertManhwareadUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    const html = await fetchHtml(target);
    return responseJson(200, parseManga(html, target, ctx));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertManhwareadUrl(requestUrl.searchParams.get("url") ?? "", ctx, true);
    const html = await fetchHtml(target);
    return responseJson(200, parseManhwareadChapter(html, target, ctx));
  }

  return responseJson(404, { error: "Route ManhwaRead inconnue" });
}
