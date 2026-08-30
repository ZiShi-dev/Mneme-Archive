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

const BASE_URL = "https://mangaforfree.com";
const SOURCE_NAME = "MangaForFree";
const SOURCE_ID = "mangaforfree";
const ALLOWED_HOSTS = new Set(["mangaforfree.com", "www.mangaforfree.com"]);
const HOST_PATTERN = /(?:^|\.)mangaforfree\.com$/i;

const { normalizeHost, normalizeAssetUrl } = createWpMangaHostHelpers({
  baseUrl: BASE_URL,
  apexHostname: "mangaforfree.com",
  hostPattern: HOST_PATTERN,
});

const { configureNativeFetch, resolveHtml, resolveImage } = createWpMangaFetchers({
  baseUrl: BASE_URL,
  apexHostname: "mangaforfree.com",
  sourceName: SOURCE_NAME,
  timeoutMs: 40_000,
  forbiddenMessage: "حماية MangaForFree منعت الاتصال مؤقتًا",
  catalogHtmlLooksValid: defaultWpMangaPageHtmlLooksValid,
});

export function configureMangaforfreeNativeFetch(options) {
  configureNativeFetch(options);
}

const fetchHtml = resolveHtml;

function isMadaraCatalogBlock(tag = "") {
  const classes = tag.match(/class=["']([^"']+)["']/i)?.[1] ?? "";
  return /\bpage-item-detail\b/.test(classes) && /\bmanga\b/.test(classes);
}

function isDooPlayCatalogArticle(tag = "") {
  const classes = tag.match(/class=["']([^"']+)["']/i)?.[1] ?? "";
  return /\bitem\b/.test(classes) && /\bwp-manga\b/.test(classes);
}

function normalizeSeriesUrl(rawUrl = "") {
  try {
    const url = new URL(decodeHtml(rawUrl).trim(), BASE_URL);
    if (url.protocol !== "https:" || !HOST_PATTERN.test(url.hostname)) return "";
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "manga" || parts.length !== 2) return "";
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
  const direct = tag.match(/(?:data-src|data-lazy-src|data-original|src)=["']([^"']+)["']/i)?.[1] ?? "";
  if (direct && !/^data:/i.test(direct)) return direct;
  return "";
}

function pushMangaforfreeCatalogItem(results, seen, {
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
    cover: normalizeAssetUrl(cover),
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
      return { url: normalizeAssetUrl(entry[1]), name, number: name };
    }));
    pushMangaforfreeCatalogItem(results, seen, {
      url,
      title,
      cover: imageFromTag(imageTag),
      chapters,
    });
  });
  return results;
}

function parseDooPlayCatalogCards(html = "") {
  const results = [];
  const seen = new Set();
  for (const match of html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)) {
    if (!isDooPlayCatalogArticle(match[1])) continue;
    const block = match[2];
    const href = extractHref(block);
    const title = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
      ?? block.match(/<img[^>]*alt=["']([^"']+)["']/i)?.[1]
      ?? "";
    const imageTag = block.match(/<img[^>]*>/i)?.[0] ?? "";
    const chapters = normalizeRecentChapters([...block.matchAll(/<span[^>]*class="[^"]*chapter[^"]*"[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((entry) => {
      const name = textOnly(entry[2]).replace(/^(?:Chapter|الفصل)\s*/i, "");
      return { url: normalizeAssetUrl(entry[1]), name, number: name };
    }));
    pushMangaforfreeCatalogItem(results, seen, {
      url: href,
      title,
      cover: imageFromTag(imageTag),
      chapters,
    });
  }
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
    pushMangaforfreeCatalogItem(results, seen, {
      url: href,
      title,
      cover: imageFromTag(imageTag),
    });
  });
  return results;
}

export function parseMangaforfreeCatalog(html = "") {
  const fromMadara = parseMadaraCatalogCards(html);
  if (fromMadara.length) return fromMadara;
  const fromDooPlay = parseDooPlayCatalogCards(html);
  if (fromDooPlay.length) return fromDooPlay;
  return parseTabCatalogCards(html);
}

function assertMangaforfreeUrl(rawUrl, chapter = false) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) throw new Error("المصدر غير مسموح");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "manga" || parts.length < (chapter ? 3 : 2)) throw new Error("رابط MangaForFree غير صالح");
  return normalizeHost(url).toString();
}

function assertMangaforfreeImageUrl(rawUrl) {
  const url = normalizeAssetUrl(rawUrl, { uploadsOnly: true });
  if (!url) throw new Error("رابط الصورة غير مسموح");
  return url;
}

export function extractMangaforfreeId(html = "") {
  return extractMadaraMangaId(html);
}

export function parseMangaforfreeChapters(html = "") {
  return parseMadaraChapters(html, { normalizeUrl: normalizeAssetUrl });
}

function parseSearch(html = "") {
  return parseTabCatalogCards(html);
}

function parseGenres(html = "") {
  const genres = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let target;
    try { target = new URL(match[1], BASE_URL); } catch { continue; }
    if (!ALLOWED_HOSTS.has(target.hostname)) continue;
    const genreMatch = target.pathname.match(/\/manga-genre\/([^/]+)/i);
    if (!genreMatch) continue;
    const slug = decodeURIComponent(genreMatch[1]);
    if (seen.has(slug)) continue;
    const label = textOnly(match[2] ?? "");
    const countMatch = label.match(/\(([\d,]+)\)\s*$/);
    const name = label.replace(/\s*\([\d,]+\)\s*$/, "").trim();
    if (!name) continue;
    seen.add(slug);
    genres.push({ slug, name, count: countMatch ? Number(countMatch[1].replace(/,/g, "")) : 0 });
  }
  return genres.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "en"));
}

function parseMangaTags(html = "") {
  const tags = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    let target;
    try { target = new URL(href, BASE_URL); } catch { continue; }
    if (!ALLOWED_HOSTS.has(target.hostname)) continue;
    const parts = target.pathname.split("/").filter(Boolean);
    const taxonomyIndex = parts.findIndex((part) => /^(?:manga-|novel-)?tags?$/i.test(part));
    if (taxonomyIndex < 0) continue;
    const archivePath = parts.slice(0, taxonomyIndex + 1).join("/");
    const slug = decodeURIComponent(parts[taxonomyIndex + 1] || "").trim();
    const name = textOnly(match[2]).replace(/^#/, "").trim();
    if (!slug || !name || seen.has(slug)) continue;
    seen.add(slug);
    tags.push({ slug, name, count: 0, archivePath });
  }
  return tags;
}

function parseManga(html, url) {
  const title = textOnly(html.match(/<div[^>]*class="[^"]*post-title[^"]*"[^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const coverBlock = html.match(/<div[^>]*class="[^"]*summary_image[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  const cover = normalizeAssetUrl(coverBlock.match(/<img[^>]*(?:src|data-src)="\s*([^\"]+)"/i)?.[1] ?? "");
  const altTitle = textOnly(html.match(/<div[^>]*class="[^"]*post-content_item[^"]*mg_alternative[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*summary-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const summary = textOnly(html.match(/<div[^>]*class="[^"]*summary__content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const chapters = parseMangaforfreeChapters(html);
  const taxonomies = parseDetailTaxonomies(html, BASE_URL);
  const tagFilters = parseMangaTags(html);
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
    tagFilters,
    chapters,
  }, { html, parser: "madara" });
}

export function parseMangaforfreeChapter(html, url) {
  const title = textOnly(html.match(/<h1[^>]*id="chapter-heading"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const pages = [];
  for (const tag of html.matchAll(/<img[^>]*class="[^"]*wp-manga-chapter-img[^"]*"[^>]*>/gi)) {
    const src = normalizeAssetUrl(tag[0].match(/(?:src|data-src)="\s*([^\"]+)"/i)?.[1] ?? "");
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
    normalizeUrl: normalizeAssetUrl,
  });
  return details;
}

export async function handleMangaforfreeRequest(requestUrl) {
  if (requestUrl.pathname.endsWith("/image")) {
    return resolveImage(requestUrl.searchParams.get("url") ?? "", assertMangaforfreeImageUrl);
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() ?? "";
    const tag = requestUrl.searchParams.get("tag")?.trim() ?? "";
    const tagPath = requestUrl.searchParams.get("tagPath")?.trim() || "manga-tag";
    if (genre && !/^[\p{L}\p{N}+_-]+$/u.test(genre)) throw new Error("تصنيف MangaForFree غير صالح");
    if (tag && !/^[\p{L}\p{N}+_-]+$/u.test(tag)) throw new Error("وسم MangaForFree غير صالح");
    if (!/^[a-z0-9/-]+$/i.test(tagPath) || tagPath.includes("..") || tagPath.startsWith("/") || tagPath.endsWith("/")) {
      throw new Error("مسار وسم MangaForFree غير صالح");
    }
    if (genre && tag) throw new Error("اختر تصنيفًا أو وسمًا واحدًا");
    const basePath = genre ? `/manga-genre/${encodeURIComponent(genre)}` : tag ? `/${tagPath}/${encodeURIComponent(tag)}` : "/manga";
    const target = page === 1 ? `${BASE_URL}${basePath}/` : `${BASE_URL}${basePath}/page/${page}/`;
    const html = await fetchHtml(target);
    const items = parseMangaforfreeCatalog(html);
    const nextPath = `${basePath}/page/${page + 1}/`;
    return responseJson(200, {
      items,
      page,
      genre,
      tag,
      hasMore: html.includes(nextPath) || html.includes(encodeURI(nextPath)),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const html = await fetchHtml(`${BASE_URL}/manga/`);
    return responseJson(200, {
      categories: parseGenres(html),
      tags: parseMangaTags(html),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() ?? "";
    const tag = requestUrl.searchParams.get("tag")?.trim() ?? "";
    const tagPath = requestUrl.searchParams.get("tagPath")?.trim() || "manga-tag";
    if (genre && !/^[\p{L}\p{N}+_-]+$/u.test(genre)) throw new Error("تصنيف MangaForFree غير صالح");
    if (tag && !/^[\p{L}\p{N}+_-]+$/u.test(tag)) throw new Error("وسم MangaForFree غير صالح");
    if (genre || tag) {
      const basePath = genre ? `/manga-genre/${encodeURIComponent(genre)}` : `/${tagPath}/${encodeURIComponent(tag)}`;
      const target = page === 1 ? `${BASE_URL}${basePath}/` : `${BASE_URL}${basePath}/page/${page}/`;
      const html = await fetchHtml(target);
      const needle = query.toLocaleLowerCase("ar");
      const items = parseMangaforfreeCatalog(html).filter((item) => item.title.toLocaleLowerCase("ar").includes(needle));
      const nextPath = `${basePath}/page/${page + 1}/`;
      return responseJson(200, {
        items,
        page,
        hasMore: html.includes(nextPath) || html.includes(encodeURI(nextPath)),
      });
    }
    const html = await fetchHtml(`${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=wp-manga`);
    return responseJson(200, { items: parseSearch(html).slice(0, 40), page: 1, hasMore: false });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertMangaforfreeUrl(requestUrl.searchParams.get("url") ?? "");
    return responseJson(200, await resolveMangaDetails(target));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertMangaforfreeUrl(requestUrl.searchParams.get("url") ?? "", true);
    const html = await fetchHtml(target);
    return responseJson(200, parseMangaforfreeChapter(html, target));
  }

  return responseJson(404, { error: "Route MangaForFree inconnue" });
}
