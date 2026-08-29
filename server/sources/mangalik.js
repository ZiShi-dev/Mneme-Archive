import { decodeHtml, parseDetailTaxonomies, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, normalizeRecentChapters } from "../lib/catalogChapters.js";
import { parseMadaraChapters, resolveMadaraChapters } from "../lib/madaraChapters.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import { extractChapterNumber } from "../lib/chapterOrdering.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";

const DEFAULT_BASE_URL = "https://mangalik.net";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);

let nativeHtmlFetcher = null;
let nativeImageFetcher = null;

export function configureMangalikNativeFetch({ fetchHtml, fetchImage } = {}) {
  nativeHtmlFetcher = fetchHtml ?? null;
  nativeImageFetcher = fetchImage ?? null;
}

function createFetcher(baseUrl = DEFAULT_BASE_URL) {
  const hostCtx = createHostContext(baseUrl);
  return createCachedHtmlFetcher({
    ttlMs: 5 * 60_000,
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "ar,en;q=0.9",
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
    buildError: (lastStatus) => (lastStatus === 403 ? "حماية MangaLik المؤقتة منعت الاتصال، أعد المحاولة بعد قليل" : `MangaLik a répondu ${lastStatus}`),
  });
}

async function resolveHtml(url, fetchHtml) {
  if (nativeHtmlFetcher) return nativeHtmlFetcher(url);
  return fetchHtml(url);
}

function assertMangaLikUrl(rawUrl, chapter = false, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) throw new Error("المصدر غير مسموح");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "manga" || parts.length < (chapter ? 3 : 2)) throw new Error("رابط MangaLik غير صالح");
  url.hostname = ctx.apex;
  return url.toString();
}

function assertMangaLikImageUrl(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  const allowedHost = ctx.hostPattern.test(url.hostname) || url.hostname.endsWith(`.${ctx.apex}`);
  const allowedPath = url.pathname.startsWith("/manga/") || url.pathname.startsWith("/wp-content/uploads/");
  if (url.protocol !== "https:" || !allowedHost || !allowedPath) throw new Error("رابط الصورة غير مسموح");
  return url.toString();
}

async function proxyImage(rawUrl, ctx) {
  const target = assertMangaLikImageUrl(rawUrl, ctx);
  if (nativeImageFetcher) return nativeImageFetcher(target);
  return fetchProxiedImage(target, `${ctx.baseUrl}/`, "MangaLik");
}

function imageFromTag(tag = "") {
  const direct = tag.match(/(?:data-src|data-lazy-src|data-original|src)="\s*([^"]+)"/i)?.[1]?.trim() ?? "";
  if (direct && !/^data:/i.test(direct)) return direct;
  const srcset = tag.match(/srcset="\s*([^"]+)"/i)?.[1] ?? "";
  const first = srcset.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
  return first || "";
}

function parseCatalog(html) {
  const results = [];
  const seen = new Set();
  const starts = [...html.matchAll(/<div[^>]*class="[^"]*page-item-detail[^"]*manga[^"]*"[^>]*>/gi)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const link = block.match(/<a[^>]*href="(https?:\/\/[^"/]+\/manga\/[^\"]+\/?)"[^>]*(?:title="([^"]*)")?[^>]*>/i);
    if (!link) return;
    const normalizedUrl = link[1].replace(/^https?:\/\/www\./i, "https://");
    if (seen.has(normalizedUrl)) return;
    const title = textOnly(block.match(/<div[^>]*class="[^"]*post-title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? link[2] ?? "");
    if (!title) return;
    const imageTag = block.match(/<img[^>]*class="[^"]*img-responsive[^"]*"[^>]*>/i)?.[0] ?? block.match(/<img[^>]*>/i)?.[0] ?? "";
    const cover = imageFromTag(imageTag);
    const chapters = normalizeRecentChapters([...block.matchAll(/<span[^>]*class="[^"]*chapter[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((entry) => {
      const name = textOnly(entry[2]);
      const number = extractChapterNumber(name, entry[1]) || name.replace(/^(?:Chapter|الفصل)\s*/i, "").trim();
      return { url: entry[1], name, number };
    }));
    seen.add(normalizedUrl);
    results.push(applyRecentChapterFields({ id: new URL(normalizedUrl).pathname.split("/").filter(Boolean).pop(), title, url: normalizedUrl, cover, source: "MangaLik", sourceId: "mangalik", mediaType: "manga", mediaTypeLabel: "مانغا" }, chapters));
  });
  return results;
}

function parseGenres(html) {
  const genres = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]*href="https?:\/\/[^"/]+\/manga-genre\/([^"\/?#]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const slug = decodeURIComponent(match[1]);
    if (seen.has(slug)) continue;
    const label = textOnly(match[2]);
    const countMatch = label.match(/\(([\d,]+)\)\s*$/);
    const name = label.replace(/\s*\([\d,]+\)\s*$/, "").trim();
    if (!name) continue;
    seen.add(slug);
    genres.push({ slug, name, count: countMatch ? Number(countMatch[1].replace(/,/g, "")) : 0 });
  }
  return genres.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ar"));
}

function parseMangaTags(html = "", ctx = DEFAULT_CTX) {
  const tags = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    const itemProp = match[1].match(/itemprop\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    let target;
    try { target = new URL(href, ctx.baseUrl); } catch { continue; }
    if (!ctx.allowedHosts.has(target.hostname.toLowerCase())) continue;
    const parts = target.pathname.split("/").filter(Boolean);
    const taxonomyIndex = parts.findIndex((part) => /^(?:manga-|novel-)?tags?$/i.test(part));
    if (taxonomyIndex < 0 && !["tag", "keywords"].includes(itemProp)) continue;
    const archivePath = (taxonomyIndex >= 0 ? parts.slice(0, taxonomyIndex + 1).join("/") : parts.slice(0, -1).join("/") || "tag").toLowerCase();
    const slug = decodeURIComponent(taxonomyIndex >= 0 ? parts[taxonomyIndex + 1] || "" : parts.at(-1) || "").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/^-+|-+$/g, "");
    const name = textOnly(match[2]).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/^#/, "").trim();
    if (!slug || !name || seen.has(slug)) continue;
    seen.add(slug);
    tags.push({ slug, name, count: 0, archivePath });
  }
  return tags;
}

async function fetchMangaTagIndex(baseUrl, fetchHtml) {
  const endpoints = ["tags", "manga-tag", "wp-manga-tag"];
  for (const endpoint of endpoints) {
    try {
      const raw = await resolveHtml(`${baseUrl}/wp-json/wp/v2/${endpoint}?per_page=40&orderby=count&order=desc`, fetchHtml);
      const data = JSON.parse(raw);
      if (!Array.isArray(data) || !data.length) continue;
      return data.map((entry) => {
        const parts = (() => { try { return new URL(entry.link || "", baseUrl).pathname.split("/").filter(Boolean); } catch { return []; } })();
        return { slug: String(entry.slug || "").trim(), name: textOnly(String(entry.name || "")), count: Number(entry.count) || 0, archivePath: parts.slice(0, -1).join("/") || endpoint };
      }).filter((entry) => entry.slug && entry.name);
    } catch { /* Essayez la taxonomie WordPress suivante. */ }
  }
  return [];
}

async function fetchMangaTagSitemap(baseUrl, fetchHtml) {
  const candidates = ["wp-sitemap-taxonomies-wp-manga-tag-1.xml", "wp-sitemap-taxonomies-manga-tag-1.xml", "manga-tag-sitemap.xml"];
  for (const filename of candidates) {
    try {
      const xml = await resolveHtml(`${baseUrl}/${filename}`, fetchHtml);
      const tags = [];
      const seen = new Set();
      for (const match of xml.matchAll(/<loc>https?:\/\/[^/]+\/(manga-tag|tag|tags)\/([^<\/?#]+)\/?<\/loc>/gi)) {
        const slug = decodeURIComponent(match[2]);
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        tags.push({ slug, name: slug.replace(/[-_]+/g, " ").trim(), count: 0, archivePath: match[1].toLowerCase() });
        if (tags.length >= 60) break;
      }
      if (tags.length) return tags;
    } catch { /* Essayez le format de sitemap suivant. */ }
  }
  return [];
}

function parseSearch(html) {
  const results = [];
  const seen = new Set();
  const starts = [...html.matchAll(/<div[^>]*class="[^"]*c-tabs-item__content[^"]*"[^>]*>/gi)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const link = block.match(/<a[^>]*href="(https?:\/\/(?:www\.)?mangalik\.net\/manga\/[^\"]+\/?)"[^>]*(?:title="([^"]*)")?[^>]*>/i);
    if (!link) return;
    const url = link[1].replace(/^https?:\/\/www\./i, "https://");
    if (seen.has(url)) return;
    const title = textOnly(block.match(/<div[^>]*class="[^"]*post-title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? link[2] ?? "");
    const imageTag = block.match(/<div[^>]*class="[^"]*tab-thumb[^"]*"[^>]*>[\s\S]*?<img[^>]*>/i)?.[0] ?? "";
    const cover = imageFromTag(imageTag);
    if (!title) return;
    seen.add(url);
    results.push({ id: new URL(url).pathname.split("/").filter(Boolean).pop(), title, url, cover, latestChapter: "—", latestChapterUrl: null, recentChapters: [], source: "MangaLik", sourceId: "mangalik", mediaType: "manga", mediaTypeLabel: "مانغا" });
  });
  return results;
}

function parseManga(html, url, ctx = DEFAULT_CTX) {
  const title = textOnly(html.match(/<div[^>]*class="[^"]*post-title[^"]*"[^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const coverBlock = html.match(/<div[^>]*class="[^"]*summary_image[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  const cover = imageFromTag(coverBlock.match(/<img[^>]*>/)?.[0] ?? "");
  const altTitle = textOnly(html.match(/<div[^>]*class="[^"]*post-content_item[^"]*mg_alternative[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*summary-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const summary = textOnly(html.match(/<div[^>]*class="[^"]*summary__content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const chapters = parseMadaraChapters(html, {
    normalizeUrl: (rawUrl) => rawUrl.replace(/^https?:\/\/www\./i, "https://"),
  });
  const taxonomies = parseDetailTaxonomies(html, ctx.baseUrl);
  const tagFilters = parseMangaTags(html, ctx);
  return enrichSourceDetails({
    id: new URL(url).pathname.split("/").filter(Boolean).pop(),
    title,
    altTitle,
    cover,
    summary,
    url,
    source: "MangaLik",
    sourceId: "mangalik",
    mediaType: "manga",
    mediaTypeLabel: "مانغا",
    ...taxonomies,
    tagFilters,
    chapters,
  }, { html, parser: "madara" });
}

function parseChapter(html, url) {
  const title = textOnly(html.match(/<h1[^>]*id="chapter-heading"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const pages = [];
  for (const tag of html.matchAll(/<img[^>]*class="[^"]*wp-manga-chapter-img[^"]*"[^>]*>/gi)) {
    const src = tag[0].match(/(?:src|data-src)="\s*([^\"]+)"/i)?.[1]?.trim();
    const alt = decodeHtml(tag[0].match(/alt="([^"]*)"/i)?.[1] ?? title);
    if (src && !pages.some((page) => page.src === src)) pages.push({ src, alt });
  }
  return { title, url, pages };
}

async function resolveMangaDetails(url, ctx, fetchHtml) {
  const html = await resolveHtml(url, fetchHtml);
  const details = parseManga(html, url, ctx);
  details.chapters = await resolveMadaraChapters(html, {
    baseUrl: ctx.baseUrl,
    refererUrl: url,
    normalizeUrl: (rawUrl) => rawUrl.replace(/^https?:\/\/www\./i, "https://"),
  });
  return details;
}

export async function handleMangalikRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: "MangaLik" });
  const fetchHtml = createFetcher(ctx.baseUrl);
  const { baseUrl } = ctx;

  if (requestUrl.pathname.endsWith("/image")) {
    return await proxyImage(requestUrl.searchParams.get("url") ?? "", ctx);
  }
  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() ?? "";
    const tag = requestUrl.searchParams.get("tag")?.trim() ?? "";
    const tagPath = requestUrl.searchParams.get("tagPath")?.trim() || "tag";
    if (genre && !/^[\p{L}\p{N}+_-]+$/u.test(genre)) throw new Error("تصنيف MangaLik غير صالح");
    if (tag && !/^[\p{L}\p{N}+_-]+$/u.test(tag)) throw new Error("وسم MangaLik غير صالح");
    if (!/^[a-z0-9/-]+$/i.test(tagPath) || tagPath.includes("..") || tagPath.startsWith("/") || tagPath.endsWith("/")) throw new Error("مسار وسم MangaLik غير صالح");
    if (genre && tag) throw new Error("اختر تصنيفًا أو وسمًا واحدًا");
    const basePath = genre ? `/manga-genre/${encodeURIComponent(genre)}` : tag ? `/${tagPath}/${encodeURIComponent(tag)}` : "/manga";
    const target = page === 1 ? `${baseUrl}${basePath}/` : `${baseUrl}${basePath}/page/${page}/`;
    const html = await resolveHtml(target, fetchHtml);
    const items = parseCatalog(html);
    const nextPath = `${basePath}/page/${page + 1}/`;
    return responseJson(200, { items, page, genre, tag, hasMore: html.includes(nextPath) || html.includes(encodeURI(nextPath)), fetchedAt: new Date().toISOString() });
  }
  if (requestUrl.pathname.endsWith("/filters")) {
    const html = await resolveHtml(`${baseUrl}/manga/`, fetchHtml);
    let tags = parseMangaTags(html, ctx);
    if (!tags.length) {
      try { tags = await fetchMangaTagIndex(baseUrl, fetchHtml); } catch { /* Repliez-vous sur les fiches récentes. */ }
    }
    if (!tags.length) tags = await fetchMangaTagSitemap(baseUrl, fetchHtml);
    if (!tags.length) {
      try { tags = parseMangaTags(await resolveHtml(`${baseUrl}/manga/eleceed/`, fetchHtml), ctx); } catch { /* Continuez avec les fiches récentes. */ }
    }
    if (!tags.length) {
      const samples = parseCatalog(html).slice(0, 6);
      const pages = await Promise.allSettled(samples.map((item) => resolveHtml(item.url, fetchHtml)));
      const merged = new Map();
      for (const result of pages) if (result.status === "fulfilled") for (const tag of parseMangaTags(result.value, ctx)) if (!merged.has(tag.slug)) merged.set(tag.slug, tag);
      tags = [...merged.values()].slice(0, 40);
    }
    return responseJson(200, { categories: parseGenres(html), tags, fetchedAt: new Date().toISOString() });
  }
  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() ?? "";
    const tag = requestUrl.searchParams.get("tag")?.trim() ?? "";
    const tagPath = requestUrl.searchParams.get("tagPath")?.trim() || "tag";
    if (genre && !/^[\p{L}\p{N}+_-]+$/u.test(genre)) throw new Error("تصنيف MangaLik غير صالح");
    if (tag && !/^[\p{L}\p{N}+_-]+$/u.test(tag)) throw new Error("وسم MangaLik غير صالح");
    if (genre || tag) {
      const basePath = genre ? `/manga-genre/${encodeURIComponent(genre)}` : `/${tagPath}/${encodeURIComponent(tag)}`;
      const target = page === 1 ? `${baseUrl}${basePath}/` : `${baseUrl}${basePath}/page/${page}/`;
      const html = await resolveHtml(target, fetchHtml);
      const needle = query.toLocaleLowerCase("ar");
      const items = parseCatalog(html).filter((item) => item.title.toLocaleLowerCase("ar").includes(needle));
      const nextPath = `${basePath}/page/${page + 1}/`;
      return responseJson(200, {
        items,
        page,
        hasMore: html.includes(nextPath) || html.includes(encodeURI(nextPath)),
      });
    }
    const html = await resolveHtml(`${baseUrl}/?s=${encodeURIComponent(query)}&post_type=wp-manga`, fetchHtml);
    return responseJson(200, { items: parseSearch(html).slice(0, 40), page: 1, hasMore: false });
  }
  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertMangaLikUrl(requestUrl.searchParams.get("url") ?? "", false, ctx);
    return responseJson(200, await resolveMangaDetails(target, ctx, fetchHtml));
  }
  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertMangaLikUrl(requestUrl.searchParams.get("url") ?? "", true, ctx);
    return responseJson(200, parseChapter(await resolveHtml(target, fetchHtml), target));
  }
  return responseJson(404, { error: "Route inconnue" });
}
