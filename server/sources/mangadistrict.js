import { decodeHtml, parseDetailTaxonomies, textOnly } from "../lib/htmlUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, normalizeRecentChapters } from "../lib/catalogChapters.js";
import {
  extractMadaraMangaId,
  parseMadaraChapters,
  resolveMadaraChapters,
} from "../lib/madaraChapters.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import { createWpMangaFetchers, createWpMangaHostHelpers, defaultWpMangaPageHtmlLooksValid } from "../lib/wpMangaHttp.js";

const BASE_URL = "https://mangadistrict.com";
const SOURCE_NAME = "MangaDistrict";
const SOURCE_ID = "mangadistrict";
const ALLOWED_HOSTS = new Set(["mangadistrict.com", "www.mangadistrict.com"]);
const HOST_PATTERN = /^(?:www\.)?mangadistrict\.com$/i;
const IMAGE_HOST_PATTERN = /^(?:(?:www|cdn)\.)?mangadistrict\.com$/i;
const SERIES_PREFIX = "series";
const GENRE_PREFIX = "publication-genre";
const DECOY_CHAPTER_IMAGE = /\/assets\/publication\/media\/image\//i;
const FILTER_SLUG_PATTERN = /^[\p{L}\p{N}+_-]+$/u;

const { normalizeHost, normalizeAssetUrl } = createWpMangaHostHelpers({
  baseUrl: BASE_URL,
  apexHostname: "mangadistrict.com",
  hostPattern: HOST_PATTERN,
  imageHostPattern: IMAGE_HOST_PATTERN,
});

const { configureNativeFetch, resolveHtml, resolveImage } = createWpMangaFetchers({
  baseUrl: BASE_URL,
  apexHostname: "mangadistrict.com",
  sourceName: SOURCE_NAME,
  timeoutMs: 40_000,
  forbiddenMessage: "حماية MangaDistrict منعت الاتصال مؤقتًا",
  catalogHtmlLooksValid: defaultWpMangaPageHtmlLooksValid,
  preferFlareSolverr: true,
});

export function configureMangadistrictNativeFetch(options) {
  configureNativeFetch(options);
}

const fetchHtml = resolveHtml;

function isMadaraCatalogBlock(tag = "") {
  const classes = tag.match(/class=["']([^"']+)["']/i)?.[1] ?? "";
  return /\bpage-item-detail\b/.test(classes) && /\bmanga\b/.test(classes);
}

function normalizeSeriesUrl(rawUrl = "") {
  try {
    const url = new URL(decodeHtml(rawUrl).trim(), BASE_URL);
    if (url.protocol !== "https:" || !HOST_PATTERN.test(url.hostname)) return "";
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== SERIES_PREFIX || parts.length !== 2) return "";
    return normalizeHost(url).toString();
  } catch {
    return "";
  }
}

function extractHref(block = "") {
  const match = block.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
  return match?.[1] ?? "";
}

function imageFromTag(tag = "") {
  const attrs = [
    "data-default-src",
    "data-mature-static",
    "data-src",
    "data-lazy-src",
    "data-original",
    "src",
  ];
  for (const attr of attrs) {
    const value = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"))?.[1] ?? "";
    if (!value || /^data:/i.test(value)) continue;
    const normalized = normalizeAssetUrl(value);
    if (normalized) return normalized;
  }
  const noscript = tag.match(/<noscript[^>]*>[\s\S]*?<img[^>]*(?:src|data-src)=["']([^"']+)["']/i)?.[1] ?? "";
  return normalizeAssetUrl(noscript);
}

function pushCatalogItem(results, seen, {
  url,
  title,
  cover,
  chapters = [],
}) {
  const normalizedUrl = normalizeSeriesUrl(url);
  if (!normalizedUrl || seen.has(normalizedUrl)) return;
  const cleanTitle = textOnly(title);
  if (!cleanTitle) return;
  seen.add(normalizedUrl);
  results.push(applyRecentChapterFields({
    id: new URL(normalizedUrl).pathname.split("/").filter(Boolean).pop(),
    title: cleanTitle,
    url: normalizedUrl,
    cover: cover || "",
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "manga",
    mediaTypeLabel: "مانغا",
  }, chapters));
}

function parseMadaraCatalogCards(html = "") {
  const results = [];
  const seen = new Set();
  const starts = [...html.matchAll(/<div\b([^>]*)>/gi)].filter((match) => isMadaraCatalogBlock(match[1]));
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    let href = "";
    let linkTitle = "";
    const direct = block.match(/<a[^>]*href=["']([^"']+)["'][^>]*(?:title=["']([^"']*)["'])?[^>]*>/i);
    if (direct) {
      href = direct[1];
      linkTitle = direct[2] || "";
    } else {
      const reversed = block.match(/<a[^>]*title=["']([^"']*)["'][^>]*href=["']([^"']+)["'][^>]*>/i);
      if (reversed) {
        linkTitle = reversed[1];
        href = reversed[2];
      }
    }
    href = href || extractHref(block);
    const url = normalizeSeriesUrl(href);
    if (!url) return;
    const title = block.match(/<div[^>]*class="[^"]*post-title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
      ?? linkTitle
      ?? block.match(/<img[^>]*alt=["']([^"']+)["']/i)?.[1]
      ?? "";
    const imageTag = block.match(/<img[^>]*class="[^"]*img-responsive[^"]*"[^>]*>/i)?.[0]
      ?? block.match(/<img[^>]*>/i)?.[0]
      ?? "";
    const chapters = normalizeRecentChapters([...block.matchAll(/<span[^>]*class="[^"]*chapter[^"]*"[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((entry) => {
      const name = textOnly(entry[2]).replace(/^(?:Chapter|الفصل)\s*/i, "");
      return { url: normalizeChapterUrl(entry[1]), name, number: name };
    }).filter((entry) => entry.url));
    pushCatalogItem(results, seen, {
      url,
      title,
      cover: imageFromTag(imageTag),
      chapters,
    });
  });
  return results;
}

function parseTabCatalogCards(html = "") {
  const results = [];
  const seen = new Set();
  const starts = [...html.matchAll(/<div[^>]*class="[^"]*c-tabs-item__content[^"]*"[^>]*>/gi)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const link = block.match(/<a[^>]*href=["']([^"']+)["'][^>]*(?:title=["']([^"']*)["'])?[^>]*>/i);
    const href = link?.[1] ?? extractHref(block);
    const title = block.match(/<div[^>]*class="[^"]*post-title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
      ?? link?.[2]
      ?? block.match(/<img[^>]*alt=["']([^"']+)["']/i)?.[1]
      ?? "";
    const imageTag = block.match(/<div[^>]*class="[^"]*tab-thumb[^"]*"[^>]*>[\s\S]*?<img[^>]*>/i)?.[0]
      ?? block.match(/<img[^>]*>/i)?.[0]
      ?? "";
    pushCatalogItem(results, seen, {
      url: href,
      title,
      cover: imageFromTag(imageTag),
    });
  });
  return results;
}

export function parseMangadistrictCatalog(html = "") {
  const fromMadara = parseMadaraCatalogCards(html);
  if (fromMadara.length) return fromMadara;
  return parseTabCatalogCards(html);
}

function normalizeChapterUrl(rawUrl = "") {
  try {
    const url = new URL(decodeHtml(rawUrl).trim(), BASE_URL);
    if (url.protocol !== "https:" || !HOST_PATTERN.test(url.hostname)) return "";
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== SERIES_PREFIX || parts.length < 3) return "";
    return normalizeHost(url).toString();
  } catch {
    return "";
  }
}

export function assertMangadistrictUrl(rawUrl, chapter = false) {
  let url;
  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("المصدر غير مسموح");
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) throw new Error("المصدر غير مسموح");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== SERIES_PREFIX || parts.length < (chapter ? 3 : 2)) {
    throw new Error("رابط MangaDistrict غير صالح");
  }
  url.hash = "";
  return normalizeHost(url).toString();
}

function assertMangadistrictImageUrl(rawUrl) {
  const url = normalizeAssetUrl(rawUrl);
  if (!url) throw new Error("رابط الصورة غير مسموح");
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const allowedPath = path.startsWith("/wp-content/uploads/")
      || path.startsWith("/thumbnail/")
      || path.startsWith("/publication/")
      || /\.(?:webp|jpe?g|png|avif|gif)$/i.test(path);
    if (!allowedPath || DECOY_CHAPTER_IMAGE.test(path)) throw new Error("رابط الصورة غير مسموح");
  } catch (error) {
    if (String(error?.message || "").includes("غير مسموح")) throw error;
    throw new Error("رابط الصورة غير مسموح");
  }
  return url;
}

export function extractMangadistrictId(html = "") {
  return extractMadaraMangaId(html)
    || html.match(/data-post-id=["'](\d+)["']/i)?.[1]
    || html.match(/class=["'][^"']*\bpost-(\d+)\b/i)?.[1]
    || "";
}

export function parseMangadistrictChapters(html = "") {
  return parseMadaraChapters(html, { normalizeUrl: (raw) => normalizeChapterUrl(raw) || normalizeAssetUrl(raw) });
}

function parseGenres(html = "") {
  const genres = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let target;
    try { target = new URL(match[1], BASE_URL); } catch { continue; }
    if (!ALLOWED_HOSTS.has(target.hostname)) continue;
    const genreMatch = target.pathname.match(new RegExp(`\\/${GENRE_PREFIX}\\/([^/]+)`, "i"));
    if (!genreMatch) continue;
    const slug = decodeURIComponent(genreMatch[1]);
    if (seen.has(slug)) continue;
    const label = textOnly(match[2] ?? "").replace(/^🔞\s*/, "");
    const countMatch = label.match(/\(([\d,]+)\)\s*$/);
    const name = label.replace(/\s*\([\d,]+\)\s*$/, "").trim();
    if (!name || name.length > 60) continue;
    seen.add(slug);
    genres.push({ slug, name, count: countMatch ? Number(countMatch[1].replace(/,/g, "")) : 0 });
  }
  return genres.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "en"));
}

function parseManga(html, url) {
  const title = textOnly(html.match(/<div[^>]*class="[^"]*post-title[^"]*"[^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const coverBlock = html.match(/<div[^>]*class="[^"]*summary_image[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  const cover = imageFromTag(coverBlock.match(/<img[^>]*>/i)?.[0] ?? "")
    || normalizeAssetUrl(coverBlock.match(/<img[^>]*(?:src|data-src|data-default-src)="\s*([^\"]+)"/i)?.[1] ?? "");
  const altTitle = textOnly(html.match(/<div[^>]*class="[^"]*post-content_item[^"]*mg_alternative[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*summary-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const summary = textOnly(html.match(/<div[^>]*class="[^"]*summary__content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const chapters = parseMangadistrictChapters(html);
  const taxonomies = parseDetailTaxonomies(html, BASE_URL);
  return enrichSourceDetails({
    id: new URL(url).pathname.split("/").filter(Boolean).pop(),
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
    chapters,
  }, { html, parser: "madara" });
}

export function parseMangadistrictChapter(html, url) {
  const title = textOnly(html.match(/<h1[^>]*id="chapter-heading"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const pages = [];
  for (const tag of html.matchAll(/<img[^>]*class="[^"]*wp-manga-chapter-img[^"]*"[^>]*>/gi)) {
    const raw = tag[0].match(/(?:data-src|src)="\s*([^\"]+)"/i)?.[1] ?? "";
    if (DECOY_CHAPTER_IMAGE.test(raw)) continue;
    const src = normalizeAssetUrl(raw);
    const alt = decodeHtml(tag[0].match(/alt="([^"]*)"/i)?.[1] ?? title);
    if (src && !pages.some((page) => page.src === src)) pages.push({ src, alt });
  }
  return { title, url, pages };
}

async function resolveMangaDetails(url) {
  const html = await fetchHtml(url);
  const details = parseManga(html, url);
  details.chapters = await resolveMadaraChapters(html, {
    baseUrl: BASE_URL,
    refererUrl: url,
    normalizeUrl: (raw) => normalizeChapterUrl(raw) || normalizeAssetUrl(raw),
    fetchHtml,
  });
  return details;
}

function assertFilterSlug(value, label) {
  const slug = String(value || "").trim();
  if (!slug) return "";
  if (!FILTER_SLUG_PATTERN.test(slug)) throw new Error(label);
  return slug;
}

export async function handleMangadistrictRequest(requestUrl) {
  if (requestUrl.pathname.endsWith("/image")) {
    return resolveImage(requestUrl.searchParams.get("url") ?? "", assertMangadistrictImageUrl);
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = assertFilterSlug(requestUrl.searchParams.get("genre"), "تصنيف MangaDistrict غير صالح");
    const basePath = genre ? `/${GENRE_PREFIX}/${encodeURIComponent(genre)}` : "/manga";
    const target = page === 1 ? `${BASE_URL}${basePath}/` : `${BASE_URL}${basePath}/page/${page}/`;
    const html = await fetchHtml(target);
    const items = parseMangadistrictCatalog(html);
    const nextPath = `${basePath}/page/${page + 1}/`;
    return responseJson(200, {
      items,
      page,
      genre,
      hasMore: html.includes(nextPath) || html.includes(encodeURI(nextPath)),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const html = await fetchHtml(`${BASE_URL}/manga/`);
    return responseJson(200, {
      categories: parseGenres(html),
      tags: [],
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = assertFilterSlug(requestUrl.searchParams.get("genre"), "تصنيف MangaDistrict غير صالح");
    if (genre) {
      const basePath = `/${GENRE_PREFIX}/${encodeURIComponent(genre)}`;
      const target = page === 1 ? `${BASE_URL}${basePath}/` : `${BASE_URL}${basePath}/page/${page}/`;
      const html = await fetchHtml(target);
      const needle = query.toLocaleLowerCase("en");
      const items = parseMangadistrictCatalog(html).filter((item) => (
        item.title.toLocaleLowerCase("en").includes(needle)
      ));
      const nextPath = `${basePath}/page/${page + 1}/`;
      return responseJson(200, {
        items,
        page,
        hasMore: html.includes(nextPath) || html.includes(encodeURI(nextPath)),
      });
    }
    const html = await fetchHtml(`${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=wp-manga`);
    return responseJson(200, { items: parseMangadistrictCatalog(html).slice(0, 40), page: 1, hasMore: false });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertMangadistrictUrl(requestUrl.searchParams.get("url") ?? "");
    return responseJson(200, await resolveMangaDetails(target));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertMangadistrictUrl(requestUrl.searchParams.get("url") ?? "", true);
    const html = await fetchHtml(target);
    return responseJson(200, parseMangadistrictChapter(html, target));
  }

  return responseJson(404, { error: "Route MangaDistrict inconnue" });
}
