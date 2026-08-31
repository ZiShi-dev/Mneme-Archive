import { decodeHtml, parseDetailTaxonomies, textOnly } from "../lib/htmlUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, normalizeRecentChapters } from "../lib/catalogChapters.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import { createWpMangaFetchers, createWpMangaHostHelpers, defaultWpMangaPageHtmlLooksValid } from "../lib/wpMangaHttp.js";

const BASE_URL = "https://hentairead.com";
const SOURCE_NAME = "HentaiRead";
const SOURCE_ID = "hentairead";
const ALLOWED_HOSTS = new Set(["hentairead.com", "www.hentairead.com"]);
const HOST_PATTERN = /(?:^|\.)hentairead\.com$/i;
const IMAGE_HOST_PATTERN = /(?:^|\.)hentairead\.com$|(?:^|\.)hencover\.xyz$/i;

const { normalizeHost, normalizeAssetUrl: normalizePrimaryAssetUrl } = createWpMangaHostHelpers({
  baseUrl: BASE_URL,
  apexHostname: "hentairead.com",
  hostPattern: HOST_PATTERN,
  imageHostPattern: IMAGE_HOST_PATTERN,
});

const { configureNativeFetch, resolveHtml, resolveImage } = createWpMangaFetchers({
  baseUrl: BASE_URL,
  apexHostname: "hentairead.com",
  sourceName: SOURCE_NAME,
  timeoutMs: 40_000,
  forbiddenMessage: "حماية HentaiRead منعت الاتصال مؤقتًا",
  catalogHtmlLooksValid: defaultWpMangaPageHtmlLooksValid,
  preferFlareSolverr: true,
});

export function configureHentaireadNativeFetch(options) {
  configureNativeFetch(options);
}

function normalizeAssetUrl(rawUrl = "") {
  return normalizePrimaryAssetUrl(rawUrl);
}

function slugFromUrl(rawUrl = "") {
  try {
    const parts = new URL(rawUrl, BASE_URL).pathname.split("/").filter(Boolean);
    if (parts[0] !== "hentai" || parts.length < 2) return "";
    return parts[1];
  } catch {
    return "";
  }
}

export function assertHentaireadUrl(rawUrl, chapter = null) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) throw new Error("المصدر غير مسموح");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "hentai" || parts.length < 2) throw new Error("رابط HentaiRead غير صالح");
  const isChapter = chapter ?? parts.includes("english");
  if (isChapter) {
    if (!parts.includes("english") || !parts.includes("p")) throw new Error("رابط فصل HentaiRead غير صالح");
  } else if (parts.length !== 2) {
    throw new Error("رابط HentaiRead غير صالح");
  }
  return normalizeHost(url).toString();
}

function assertHentaireadImageUrl(rawUrl) {
  const normalized = normalizeAssetUrl(rawUrl);
  if (!normalized) throw new Error("رابط الصورة غير مسموح");
  return normalized;
}

export function buildHentaireadReaderUrl(mangaUrl, page = 1) {
  const base = assertHentaireadUrl(mangaUrl).replace(/\/+$/, "");
  return `${base}/english/p/${page}/`;
}

function imageFromTag(tag = "") {
  const direct = tag.match(/(?:data-src|data-lazy-src|data-original|src)=["']([^"']+)["']/i)?.[1] ?? "";
  if (direct && !/^data:/i.test(direct)) return normalizeAssetUrl(direct);
  const srcset = tag.match(/srcset=["']([^"']+)["']/i)?.[1] ?? "";
  const first = srcset.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
  return normalizeAssetUrl(first);
}

function isHentaireadMangaCard(tagAttrs = "") {
  const classes = tagAttrs.match(/class=["']([^"']+)["']/i)?.[1] ?? "";
  return /(^|\s)manga-item(\s|$)/.test(classes);
}

function extractCatalogCardBlock(html, startIndex, nextIndex) {
  return html.slice(startIndex, nextIndex ?? html.length);
}

export function parseHentaireadCatalog(html = "") {
  const results = [];
  const seen = new Set();
  const starts = [
    ...html.matchAll(/<(?:article|div)\b([^>]*)>/gi),
  ].filter((match) => isHentaireadMangaCard(match[1]));

  starts.forEach((match, index) => {
    const block = extractCatalogCardBlock(html, match.index, starts[index + 1]?.index);
    const link = block.match(/<a[^>]*class=["'][^"']*manga-item__link[^"']*["'][^>]*href=["']([^"']+)["']/i)
      ?? block.match(/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*manga-item__link/i)
      ?? block.match(/<a[^>]*href=["'](https?:\/\/(?:www\.)?hentairead\.com\/hentai\/[^"'?#]+\/?)["']/i)
      ?? block.match(/href=["'](https?:\/\/(?:www\.)?hentairead\.com\/hentai\/[^"'?#]+\/?)["']/i);
    if (!link) return;
    const slug = link[1].match(/\/hentai\/([^/?#]+)/i)?.[1];
    if (!slug) return;
    const url = `https://hentairead.com/hentai/${slug}/`;
    if (seen.has(url)) return;
    const title = [
      block.match(/<a[^>]*class=["'][^"']*manga-item__link[^"']*["'][^>]*title=["']([^"']+)["']/i)?.[1],
      block.match(/<a[^>]*class=["'][^"']*manga-item__link[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1],
      block.match(/<img[^>]*class=["'][^"']*manga-item__img-inner[^"']*["'][^>]*alt=["']([^"']+)["']/i)?.[1],
      block.match(/alt=["']([^"']+)["'][^>]*class=["'][^"']*manga-item__img-inner/i)?.[1],
      block.match(/class=["'][^"']*line-clamp-2[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
    ].map((value) => textOnly(value || "")).find(Boolean) || "";
    if (!title) return;
    const imageTag = block.match(/<div[^>]*class=["'][^"']*manga-item__img[^"']*["'][^>]*>[\s\S]*?<img[^>]*>/i)?.[0]
      ?? block.match(/<img[^>]*class=["'][^"']*manga-item__img-inner[^"']*["'][^>]*>/i)?.[0]
      ?? block.match(/<img[^>]*>/i)?.[0]
      ?? "";
    const cover = imageFromTag(imageTag)
      || normalizeAssetUrl(block.match(/<meta[^>]*content=["'](https?:\/\/[^"']+)["']/i)?.[1] ?? "");
    seen.add(url);
    results.push(applyRecentChapterFields({
      id: slugFromUrl(url),
      title,
      url,
      cover,
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType: "manga",
      mediaTypeLabel: "مانغا",
      publicationStatus: "completed",
    }, []));
  });
  return results;
}

function parseHentaireadGenres(html = "") {
  const genres = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let target;
    try { target = new URL(match[1], BASE_URL); } catch { continue; }
    if (!ALLOWED_HOSTS.has(target.hostname)) continue;
    const genreMatch = target.pathname.match(/\/genre\/([^/]+)/i);
    if (!genreMatch) continue;
    const slug = decodeURIComponent(genreMatch[1]);
    if (!slug || seen.has(slug)) continue;
    const name = textOnly(match[2] ?? "").replace(/\s*\([\d,]+\)\s*$/, "").trim();
    if (!name) continue;
    seen.add(slug);
    genres.push({ slug, name, count: 0 });
  }
  return genres.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

function parseHentaireadTags(html = "") {
  const tags = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let target;
    try { target = new URL(match[1], BASE_URL); } catch { continue; }
    if (!ALLOWED_HOSTS.has(target.hostname)) continue;
    const tagMatch = target.pathname.match(/\/tag\/([^/]+)/i);
    if (!tagMatch) continue;
    const slug = decodeURIComponent(tagMatch[1]);
    if (!slug || seen.has(slug)) continue;
    const name = textOnly(match[2] ?? "").replace(/\s*\([\d,]+\)\s*$/, "").trim();
    if (!name) continue;
    seen.add(slug);
    tags.push({ slug, name, count: 0, archivePath: "tag" });
  }
  return tags.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export function extractHentaireadChapterImages(html = "") {
  const source = String(html);
  const inlined = [];
  for (const tag of source.matchAll(/<img[^>]*class="[^"]*(?:chapter-image|wp-manga-chapter-img)[^"]*"[^>]*>/gi)) {
    const src = tag[0].match(/(?:src|data-src)=["'](data:image\/[^"']+)["']/i)?.[1] ?? "";
    if (src && !inlined.some((page) => page.src === src)) {
      inlined.push({ src, alt: textOnly(tag[0].match(/alt=["']([^"']*)["']/i)?.[1] ?? "") });
    }
  }
  if (inlined.length) return inlined;
  const baseUrlMatch = source.match(/["']baseUrl["']\s*:\s*["'](https?:\/\/[^"']+)["']/i)
    ?? source.match(/baseUrl["']\s*:\s*["'](https?:\/\/[^"']+)["']/i)
    ?? source.match(/var\s+single_chapter\s*=\s*\{[\s\S]*?["']baseUrl["']\s*:\s*["'](https?:\/\/[^"']+)["']/i);
  const baseUrl = (baseUrlMatch?.[1] || "").replace(/\/+$/, "");
  const b64Match = source.match(/id=["']single-chapter-js-before["'][^>]*>[\s\S]*?\.(ey[A-Za-z0-9+/=_-]+)/i)
    ?? source.match(/single_chapter[^>]*>[\s\S]*?\.(ey[A-Za-z0-9+/=_-]{20,})/i)
    ?? source.match(/\.(ey[A-Za-z0-9+/=_-]{20,})/);
  if (baseUrl && b64Match) {
    try {
      const payload = JSON.parse(Buffer.from(b64Match[1], "base64").toString("utf8"));
      const images = payload?.data?.chapter?.images || payload?.chapter?.images || [];
      const pages = images
        .map((entry) => {
          const src = normalizeAssetUrl(entry?.src ? `${baseUrl}/${String(entry.src).replace(/^\/+/, "")}` : "");
          return src ? { src, alt: textOnly(entry?.alt || "") } : null;
        })
        .filter(Boolean);
      if (pages.length) return pages;
    } catch {
      // Fall through to DOM image parsing.
    }
  }

  const pages = [];
  for (const tag of source.matchAll(/<img[^>]*class="[^"]*(?:chapter-image|wp-manga-chapter-img)[^"]*"[^>]*>/gi)) {
    const src = imageFromTag(tag[0]);
    if (src && !pages.some((page) => page.src === src)) {
      pages.push({ src, alt: textOnly(tag[0].match(/alt=["']([^"']*)["']/i)?.[1] ?? "") });
    }
  }
  return pages;
}

export function parseHentaireadChapter(html, url) {
  const title = textOnly(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const pages = extractHentaireadChapterImages(html);
  return { title, url, pages };
}

function parseHentaireadManga(html, url) {
  const title = textOnly(
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)"/i)?.[1]
    ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? "",
  );
  const cover = normalizeAssetUrl(
    html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)"/i)?.[1] ?? "",
  ) || imageFromTag(html.match(/<img[^>]*class="[^"]*summary_image[^"]*"[^>]*>/i)?.[0] ?? "");
  const altTitle = textOnly(html.match(/<div[^>]*class=["'][^"']*manga-titles[^"']*["'][^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "");
  const summary = textOnly(html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)"/i)?.[1] ?? "");
  const readerUrl = buildHentaireadReaderUrl(url);
  const chapters = [{
    url: readerUrl,
    name: "English",
    number: "1",
    date: "",
  }];
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
    publicationStatus: "completed",
    ...taxonomies,
    chapters,
  }, { html, parser: "madara" });
}

function buildCatalogTarget({ page = 1, genre = "", tag = "", sortby = "new" } = {}) {
  const safePage = Math.min(Math.max(Number(page) || 1, 1), 1000);
  const query = new URLSearchParams();
  if (sortby && sortby !== "new") query.set("sortby", sortby);
  const querySuffix = query.toString() ? `?${query}` : "";
  if (genre) {
    const base = `/genre/${encodeURIComponent(genre)}`;
    return safePage === 1 ? `${BASE_URL}${base}/${querySuffix}` : `${BASE_URL}${base}/page/${safePage}/${querySuffix}`;
  }
  if (tag) {
    const base = `/tag/${encodeURIComponent(tag)}`;
    return safePage === 1 ? `${BASE_URL}${base}/${querySuffix}` : `${BASE_URL}${base}/page/${safePage}/${querySuffix}`;
  }
  const catalogQuery = query.toString() ? `?${query}` : (sortby === "new" ? "?sortby=new" : "");
  return safePage === 1 ? `${BASE_URL}/hentai/${catalogQuery}` : `${BASE_URL}/hentai/page/${safePage}/${catalogQuery}`;
}

function catalogHasMore(html, { page = 1, genre = "", tag = "" } = {}) {
  if (html.includes('rel="next"') || html.includes("rel='next'")) return true;
  const nextPage = page + 1;
  if (genre) return html.includes(`/genre/${encodeURIComponent(genre)}/page/${nextPage}/`);
  if (tag) return html.includes(`/tag/${encodeURIComponent(tag)}/page/${nextPage}/`);
  return html.includes(`/hentai/page/${nextPage}/`);
}

export async function handleHentaireadRequest(requestUrl) {
  if (requestUrl.pathname.endsWith("/image")) {
    return resolveImage(requestUrl.searchParams.get("url") ?? "", assertHentaireadImageUrl);
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const html = await resolveHtml(`${BASE_URL}/hentai/?sortby=views`);
    return responseJson(200, {
      categories: parseHentaireadGenres(html),
      tags: parseHentaireadTags(html),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() ?? "";
    const tag = requestUrl.searchParams.get("tag")?.trim() ?? "";
    const sortby = requestUrl.searchParams.get("sortby")?.trim()
      || requestUrl.searchParams.get("type")?.trim()
      || "new";
    if (genre && !/^[\p{L}\p{N}+_%.\-]+$/u.test(genre)) throw new Error("تصنيف HentaiRead غير صالح");
    if (tag && !/^[\p{L}\p{N}+_%.\-]+$/u.test(tag)) throw new Error("وسم HentaiRead غير صالح");
    if (sortby && !/^[a-z0-9_-]+$/i.test(sortby)) throw new Error("ترتيب HentaiRead غير صالح");
    const html = await resolveHtml(buildCatalogTarget({ page, genre, tag, sortby }));
    const items = parseHentaireadCatalog(html);
    return responseJson(200, {
      items,
      page,
      genre,
      tag,
      sortby,
      hasMore: catalogHasMore(html, { page, genre, tag }),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() ?? "";
    const tag = requestUrl.searchParams.get("tag")?.trim() ?? "";
    const sortby = requestUrl.searchParams.get("sortby")?.trim()
      || requestUrl.searchParams.get("sort")?.trim()
      || "new";
    if (genre || tag) {
      const html = await resolveHtml(buildCatalogTarget({ page, genre, tag, sortby }));
      const needle = query.toLocaleLowerCase("en");
      const items = parseHentaireadCatalog(html).filter((item) => item.title.toLocaleLowerCase("en").includes(needle));
      return responseJson(200, { items, page, hasMore: catalogHasMore(html, { page, genre, tag }) });
    }
    const html = await resolveHtml(`${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}&post_type=wp-manga&title-type=contains`);
    return responseJson(200, {
      items: parseHentaireadCatalog(html),
      page,
      hasMore: html.includes(`page/${page + 1}/`),
    });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const raw = requestUrl.searchParams.get("url") ?? "";
    const target = raw.includes("/english/") ? assertHentaireadUrl(raw.replace(/\/english\/.*$/, "/"), false) : assertHentaireadUrl(raw);
    const html = await resolveHtml(target);
    return responseJson(200, parseHentaireadManga(html, target));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertHentaireadUrl(requestUrl.searchParams.get("url") ?? "", true);
    const html = await resolveHtml(target, { includeAssets: true });
    return responseJson(200, parseHentaireadChapter(html, target));
  }

  return responseJson(404, { error: "Route HentaiRead inconnue" });
}
