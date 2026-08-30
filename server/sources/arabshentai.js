import { decodeHtml, parseDetailTaxonomies, textOnly } from "../lib/htmlUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, normalizeRecentChapters } from "../lib/catalogChapters.js";
import { parseChapterDateString } from "../lib/chapterDates.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import { createWpMangaFetchers, createWpMangaHostHelpers, defaultWpMangaPageHtmlLooksValid } from "../lib/wpMangaHttp.js";

const BASE_URL = "https://arabshentai.com";
const SOURCE_NAME = "Arabs Hentai";
const SOURCE_ID = "arabshentai";
const ALLOWED_HOSTS = new Set(["arabshentai.com", "www.arabshentai.com"]);
const HOST_PATTERN = /(?:^|\.)arabshentai\.com$/i;
const { normalizeHost, normalizeAssetUrl: normalizeHostAssetUrl } = createWpMangaHostHelpers({
  baseUrl: BASE_URL,
  apexHostname: "arabshentai.com",
  hostPattern: HOST_PATTERN,
});

const { configureNativeFetch, resolveHtml, resolveImage } = createWpMangaFetchers({
  baseUrl: BASE_URL,
  apexHostname: "arabshentai.com",
  sourceName: SOURCE_NAME,
  acceptLanguage: "ar,en;q=0.8",
  timeoutMs: 40_000,
  forbiddenMessage: "حماية Arabs Hentai منعت الاتصال مؤقتًا",
  catalogHtmlLooksValid: defaultWpMangaPageHtmlLooksValid,
});

export function configureArabshentaiNativeFetch(options) {
  configureNativeFetch(options);
}

const normalizeAssetUrl = normalizeHostAssetUrl;

function slugFromUrl(rawUrl = "") {
  try {
    const parts = new URL(rawUrl, BASE_URL).pathname.split("/").filter(Boolean);
    if (parts[0] !== "manga" || parts.length < 2) return "";
    return parts[1];
  } catch {
    return "";
  }
}

function isChapterSegment(segment = "") {
  return /^\d+(?:_\d+)?$/i.test(segment);
}

export function assertArabshentaiUrl(rawUrl, chapter = null) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) throw new Error("المصدر غير مسموح");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "manga" || parts.length < 2) throw new Error("رابط Arabs Hentai غير صالح");
  const last = parts.at(-1) || "";
  const isChapter = chapter ?? isChapterSegment(last);
  if (isChapter) {
    if (parts.length < 3 || !isChapterSegment(last)) throw new Error("رابط فصل Arabs Hentai غير صالح");
  } else if (parts.length !== 2 || isChapterSegment(last)) {
    throw new Error("رابط Arabs Hentai غير صالح");
  }
  return normalizeHost(url).toString();
}

function assertArabshentaiImageUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !HOST_PATTERN.test(url.hostname)) throw new Error("رابط الصورة غير مسموح");
  if (!url.pathname.startsWith("/wp-content/uploads/")) throw new Error("رابط الصورة غير مسموح");
  return normalizeHost(url).toString();
}

function chapterNumberFromLabel(label = "", segment = "") {
  const fromSegment = segment.split("_")[0];
  if (/^\d+(?:\.\d+)?$/.test(fromSegment)) return fromSegment;
  const match = label.match(/(\d+(?:\.\d+)?)/);
  return match?.[1] || label.trim() || fromSegment || "—";
}

export function parseArabshentaiChapters(html = "") {
  const chapters = [];
  const seen = new Set();
  const listBlock = html.match(/<div[^>]*id=["']chapter-list["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? html;
  for (const match of listBlock.matchAll(/<li[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/li>/gi)) {
    const url = normalizeAssetUrl(match[1]);
    if (!url || seen.has(url)) continue;
    const block = match[2];
    const label = textOnly(block.match(/class=["'][^"']*chapternum[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? block);
    const date = textOnly(block.match(/class=["'][^"']*chapterdate[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const segment = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
    const number = chapterNumberFromLabel(label, segment);
    const publishedAt = parseChapterDateString(date);
    seen.add(url);
    chapters.push({
      url,
      name: label || number,
      number,
      date,
      ...(publishedAt ? { publishedAt } : {}),
    });
  }
  return chapters;
}

function catalogKindFields(catalogType = "") {
  if (catalogType === "anime") {
    return { catalogKind: "anime", mediaType: "anime", mediaTypeLabel: "أنمي" };
  }
  if (catalogType === "manhwa") {
    return { catalogKind: "manhwa", mediaType: "manga", mediaTypeLabel: "مانهوا" };
  }
  if (catalogType) {
    return { catalogKind: catalogType, mediaType: "manga", mediaTypeLabel: "مانغا" };
  }
  return { mediaType: "manga", mediaTypeLabel: "مانغا" };
}

function isDooPlayCatalogArticle(tag = "") {
  const classes = tag.match(/class=["']([^"']+)["']/i)?.[1] ?? "";
  return /\bitem\b/.test(classes) && /\bwp-manga\b/.test(classes);
}

function pushArabshentaiCatalogItem(results, seen, {
  url,
  title,
  cover,
  chapters,
  catalogType = "",
}) {
  const normalizedUrl = url.replace("www.arabshentai.com", "arabshentai.com");
  if (!normalizedUrl || seen.has(normalizedUrl)) return;
  const cleanTitle = textOnly(title);
  if (!cleanTitle) return;
  seen.add(normalizedUrl);
  results.push(applyRecentChapterFields({
    id: slugFromUrl(normalizedUrl),
    title: cleanTitle,
    url: normalizedUrl,
    cover: normalizeAssetUrl(cover),
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    ...catalogKindFields(catalogType),
  }, chapters));
}

function parseArabshentaiDooPlayCatalog(html = "", catalogType = "") {
  const results = [];
  const seen = new Set();
  for (const match of html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)) {
    if (!isDooPlayCatalogArticle(match[1])) continue;
    const block = match[2];
    const link = block.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
    if (!link) continue;
    const slug = link[1].match(/\/manga\/([^/?#]+)/i)?.[1];
    if (!slug) continue;
    const url = `https://arabshentai.com/manga/${slug}/`;
    const title = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
      ?? block.match(/<img[^>]*alt="([^"]+)"/i)?.[1]
      ?? "";
    const imageTag = block.match(/<img[^>]*>/i)?.[0] ?? "";
    const cover = imageTag.match(/(?:src|data-src)=["']([^"']+)["']/i)?.[1] ?? "";
    const chapters = normalizeRecentChapters([...block.matchAll(/<span[^>]*class="[^"]*chapter[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((entry) => {
      const number = textOnly(entry[2]).trim();
      return { url: normalizeAssetUrl(entry[1]), name: number, number };
    }));
    pushArabshentaiCatalogItem(results, seen, {
      url,
      title,
      cover,
      chapters,
      catalogType,
    });
  }
  return results;
}

function parseArabshentaiMadaraCatalog(html = "", catalogType = "") {
  const results = [];
  const seen = new Set();
  const starts = [...html.matchAll(/<div[^>]*class="[^"]*page-item-detail[^"]*manga[^"]*"[^>]*>/gi)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const link = block.match(/<a[^>]*href=["']([^"']+)["'][^>]*(?:title=["']([^"']*)["'])?/i);
    if (!link) return;
    const slug = link[1].match(/\/manga\/([^/?#]+)/i)?.[1];
    if (!slug) return;
    const url = `https://arabshentai.com/manga/${slug}/`;
    const title = block.match(/<div[^>]*class="[^"]*post-title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? link[2] ?? "";
    const imageTag = block.match(/<img[^>]*class="[^"]*img-responsive[^"]*"[^>]*>/i)?.[0] ?? block.match(/<img[^>]*>/i)?.[0] ?? "";
    const cover = imageTag.match(/(?:src|data-src)=["']([^"']+)["']/i)?.[1] ?? "";
    const chapters = normalizeRecentChapters([...block.matchAll(/<span[^>]*class="[^"]*chapter[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((entry) => {
      const number = textOnly(entry[2]).trim();
      return { url: normalizeAssetUrl(entry[1]), name: number, number };
    }));
    pushArabshentaiCatalogItem(results, seen, {
      url,
      title,
      cover,
      chapters,
      catalogType,
    });
  });
  return results;
}

export function parseArabshentaiCatalog(html = "", { catalogType = "" } = {}) {
  const fromDooPlay = parseArabshentaiDooPlayCatalog(html, catalogType);
  if (fromDooPlay.length) return fromDooPlay;
  return parseArabshentaiMadaraCatalog(html, catalogType);
}

function parseArabshentaiGenres(html = "") {
  const genres = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let target;
    try { target = new URL(match[1], BASE_URL); } catch { continue; }
    if (!ALLOWED_HOSTS.has(target.hostname)) continue;
    const genreMatch = target.pathname.match(/\/manga-genre\/([^/]+)/i);
    if (!genreMatch) continue;
    const slug = decodeURIComponent(genreMatch[1]);
    if (!slug || seen.has(slug)) continue;
    const label = textOnly(match[2] ?? "");
    const countMatch = label.match(/\(([\d,]+)\)\s*$/);
    const name = label.replace(/\s*\([\d,]+\)\s*$/, "").trim();
    if (!name) continue;
    seen.add(slug);
    genres.push({ slug, name, count: countMatch ? Number(countMatch[1].replace(/,/g, "")) : 0 });
  }
  return genres.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ar"));
}

function parseArabshentaiSearch(html = "", catalogType = "") {
  return parseArabshentaiCatalog(html, { catalogType });
}

function parseArabshentaiManga(html, url) {
  const title = textOnly(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const cover = normalizeAssetUrl(
    html.match(/<div[^>]*class=["'][^"']*poster[^"']*["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)"/i)?.[1]
    ?? html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)"/i)?.[1]
    ?? "",
  );
  const altTitle = textOnly(html.match(/<b[^>]*class=["'][^"']*variante[^"']*["'][^>]*>[\s\S]*?<\/b>[\s\S]*?<span[^>]*class=["'][^"']*valor[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const summary = textOnly(html.match(/<div[^>]*id=["']manga-info["'][^>]*>[\s\S]*?<div[^>]*class=["'][^"']*wp-content[^"']*["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const taxonomies = parseDetailTaxonomies(html, BASE_URL);
  return enrichSourceDetails({
    id: slugFromUrl(url),
    title,
    altTitle,
    cover,
    summary,
    url,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "manga",
    mediaTypeLabel: "مانغا",
    ...taxonomies,
    chapters: parseArabshentaiChapters(html),
  }, { html, parser: "dooplay" });
}

export function parseArabshentaiChapter(html, url) {
  const title = textOnly(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const pages = [];
  for (const tag of html.matchAll(/<img[^>]*class="[^"]*wp-manga-chapter-img[^"]*"[^>]*>/gi)) {
    const src = normalizeAssetUrl(tag[0].match(/(?:src|data-src)=["']([^"']+)["']/i)?.[1] ?? "");
    const alt = decodeHtml(tag[0].match(/alt=["']([^"']*)["']/i)?.[1] ?? title);
    if (src && !pages.some((page) => page.src === src)) pages.push({ src, alt });
  }
  return { title, url, pages };
}

function buildCatalogTarget({ page = 1, genre = "", type = "" } = {}) {
  const safePage = Math.min(Math.max(Number(page) || 1, 1), 1000);
  const query = new URLSearchParams();
  if (type) query.set("type", type);
  const querySuffix = query.toString() ? `?${query}` : "";
  if (genre) {
    const base = `/manga-genre/${encodeURIComponent(genre)}`;
    return safePage === 1 ? `${BASE_URL}${base}/${querySuffix}` : `${BASE_URL}${base}/page/${safePage}/${querySuffix}`;
  }
  return safePage === 1 ? `${BASE_URL}/manga/${querySuffix}` : `${BASE_URL}/manga/page/${safePage}/${querySuffix}`;
}

function catalogHasMore(html, { page = 1, genre = "", type = "" } = {}) {
  const nextPage = page + 1;
  const query = type ? `?type=${encodeURIComponent(type)}` : "";
  if (genre) {
    const nextPath = `/manga-genre/${encodeURIComponent(genre)}/page/${nextPage}/`;
    return html.includes(nextPath) || html.includes(encodeURI(nextPath));
  }
  const nextPath = `/manga/page/${nextPage}/${query}`;
  return html.includes(nextPath) || html.includes(encodeURI(nextPath));
}

export function mergeArabshentaiCatalogItems(groups = []) {
  const seen = new Set();
  const items = [];
  for (const group of groups) {
    for (const item of group) {
      if (!item?.url || seen.has(item.url)) continue;
      seen.add(item.url);
      items.push(item);
    }
  }
  return items;
}

async function fetchArabshentaiCatalog({ page, genre, type }) {
  const html = await resolveHtml(buildCatalogTarget({ page, genre, type }));
  return {
    items: parseArabshentaiCatalog(html, { catalogType: type }),
    hasMore: catalogHasMore(html, { page, genre, type }),
  };
}

export async function handleArabshentaiRequest(requestUrl) {
  if (requestUrl.pathname.endsWith("/image")) {
    return resolveImage(requestUrl.searchParams.get("url") ?? "", assertArabshentaiImageUrl);
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const html = await resolveHtml(`${BASE_URL}/%d8%aa%d8%b5%d9%86%d9%8a%d9%81%d8%a7%d8%aa/`);
    return responseJson(200, {
      categories: parseArabshentaiGenres(html),
      tags: [],
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() ?? "";
    const type = requestUrl.searchParams.get("type")?.trim() ?? "";
    if (genre && !/^[\p{L}\p{N}+_%.\-]+$/u.test(genre)) throw new Error("تصنيف Arabs Hentai غير صالح");
    if (type && !/^[a-z0-9_-]+$/i.test(type)) throw new Error("نوع Arabs Hentai غير صالح");
    const { items, hasMore } = await fetchArabshentaiCatalog({ page, genre, type });
    return responseJson(200, {
      items,
      page,
      genre,
      type,
      hasMore,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() ?? "";
    const type = requestUrl.searchParams.get("type")?.trim() ?? "";
    if (genre) {
      const { items: catalogItems, hasMore } = await fetchArabshentaiCatalog({ page, genre, type });
      const needle = query.toLocaleLowerCase("ar");
      const items = catalogItems.filter((item) => item.title.toLocaleLowerCase("ar").includes(needle));
      return responseJson(200, {
        items,
        page,
        hasMore,
      });
    }
    const html = await resolveHtml(`${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=wp-manga`);
    return responseJson(200, { items: parseArabshentaiSearch(html).slice(0, 40), page: 1, hasMore: false });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertArabshentaiUrl(requestUrl.searchParams.get("url") ?? "");
    const html = await resolveHtml(target);
    return responseJson(200, parseArabshentaiManga(html, target));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertArabshentaiUrl(requestUrl.searchParams.get("url") ?? "", true);
    const html = await resolveHtml(target);
    return responseJson(200, parseArabshentaiChapter(html, target));
  }

  return responseJson(404, { error: "Route Arabs Hentai inconnue" });
}
