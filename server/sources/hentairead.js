import { decodeHtml, parseDetailTaxonomies, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, normalizeRecentChapters } from "../lib/catalogChapters.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";

const BASE_URL = "https://hentairead.com";
const SOURCE_NAME = "HentaiRead";
const SOURCE_ID = "hentairead";
const ALLOWED_HOSTS = new Set(["hentairead.com", "www.hentairead.com"]);
const HOST_PATTERN = /(?:^|\.)hentairead\.com$/i;
const IMAGE_HOST_PATTERN = /(?:^|\.)hentairead\.com$|(?:^|\.)hencover\.xyz$/i;
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let nativeHtmlFetcher = null;
let nativeImageFetcher = null;

export function configureHentaireadNativeFetch({ fetchHtml, fetchImage } = {}) {
  nativeHtmlFetcher = fetchHtml ?? null;
  nativeImageFetcher = fetchImage ?? null;
}

const fetchHtmlRemote = createCachedHtmlFetcher({
  ttlMs: 5 * 60_000,
  timeoutMs: 40_000,
  headers: {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en,ar;q=0.8",
    referer: `${BASE_URL}/`,
    "user-agent": BROWSER_UA,
  },
  getVariants: (url) => {
    try {
      const parsed = new URL(url);
      const alt = new URL(url);
      alt.hostname = parsed.hostname === "www.hentairead.com" ? "hentairead.com" : "www.hentairead.com";
      return alt.toString() === url ? [url] : [url, alt.toString()];
    } catch {
      return [url];
    }
  },
  buildError: (lastStatus) => (lastStatus === 403
    ? "حماية HentaiRead منعت الاتصال مؤقتًا"
    : `HentaiRead a répondu ${lastStatus || "sans réponse"}`),
});

async function resolveHtml(url) {
  if (nativeHtmlFetcher) return nativeHtmlFetcher(url);
  return fetchHtmlRemote(url);
}

async function resolveImage(target) {
  if (nativeImageFetcher) return nativeImageFetcher(target);
  return fetchProxiedImage(target, `${BASE_URL}/`, SOURCE_NAME);
}

function normalizeHost(url) {
  url.hostname = "hentairead.com";
  return url;
}

function normalizeAssetUrl(rawUrl = "") {
  const cleaned = decodeHtml(String(rawUrl)).replace(/\s+/g, "").trim();
  if (!cleaned) return "";
  try {
    const url = new URL(cleaned, BASE_URL);
    if (url.protocol !== "https:" || !IMAGE_HOST_PATTERN.test(url.hostname)) return "";
    if (HOST_PATTERN.test(url.hostname)) return normalizeHost(url).toString();
    return url.toString();
  } catch {
    return "";
  }
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

export function parseHentaireadCatalog(html = "") {
  const results = [];
  const seen = new Set();
  for (const match of html.matchAll(/<article[^>]*class="[^"]*manga-item[^"]*"[^>]*>([\s\S]*?)<\/article>/gi)) {
    const block = match[1];
    const link = block.match(/<a[^>]*class="[^"]*manga-item__link[^"]*"[^>]*href="([^"]+)"/i)
      ?? block.match(/<a[^>]*href="(https?:\/\/(?:www\.)?hentairead\.com\/hentai\/[^"?#]+\/?)"[^>]*class="[^"]*manga-item__link/i);
    if (!link) continue;
    const url = link[1].replace("www.hentairead.com", "hentairead.com");
    if (seen.has(url)) continue;
    const title = textOnly(
      block.match(/<img[^>]*class="[^"]*manga-item__img-inner[^"]*"[^>]*alt="([^"]+)"/i)?.[1]
      ?? block.match(/class="[^"]*manga-item__detail[^"]*"[\s\S]*?line-clamp-2[^>]*>([\s\S]*?)<\/div>/i)?.[1]
      ?? block.match(/<a[^>]*class="[^"]*manga-item__link[^"]*"[^>]*title="([^"]+)"/i)?.[1]
      ?? "",
    );
    if (!title) continue;
    const imageTag = block.match(/<img[^>]*class="[^"]*manga-item__img-inner[^"]*"[^>]*>/i)?.[0] ?? "";
    const cover = normalizeAssetUrl(imageTag.match(/(?:src|data-src)=["']([^"']+)["']/i)?.[1] ?? "");
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
  }
  return results;
}

function parseHentaireadGenres(html = "") {
  const genres = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]*href="https?:\/\/(?:www\.)?hentairead\.com\/genre\/([^"\/?#]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const slug = decodeURIComponent(match[1]);
    if (!slug || seen.has(slug)) continue;
    const name = textOnly(match[2]).replace(/\s*\([\d,]+\)\s*$/, "").trim();
    if (!name) continue;
    seen.add(slug);
    genres.push({ slug, name, count: 0 });
  }
  return genres.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

function parseHentaireadTags(html = "") {
  const tags = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]*href="https?:\/\/(?:www\.)?hentairead\.com\/tag\/([^"\/?#]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const slug = decodeURIComponent(match[1]);
    if (!slug || seen.has(slug)) continue;
    const name = textOnly(match[2]).replace(/\s*\([\d,]+\)\s*$/, "").trim();
    if (!name) continue;
    seen.add(slug);
    tags.push({ slug, name, count: 0, archivePath: "tag" });
  }
  return tags.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export function extractHentaireadChapterImages(html = "") {
  const baseUrlMatch = html.match(/["']baseUrl["']\s*:\s*["'](https?:\/\/[^"']+)["']/i)
    ?? html.match(/baseUrl["']\s*:\s*["'](https?:\/\/[^"']+)["']/i);
  const baseUrl = (baseUrlMatch?.[1] || "").replace(/\/+$/, "");
  const b64Match = html.match(/id=["']single-chapter-js-before["'][^>]*>[\s\S]*?\.(ey[A-Za-z0-9+/=_-]+)/i)
    ?? html.match(/\.(ey[A-Za-z0-9+/=_-]{20,})/);
  if (!baseUrl || !b64Match) return [];
  try {
    const payload = JSON.parse(Buffer.from(b64Match[1], "base64").toString("utf8"));
    const images = payload?.data?.chapter?.images || payload?.chapter?.images || [];
    return images
      .map((entry) => {
        const src = normalizeAssetUrl(entry?.src ? `${baseUrl}/${String(entry.src).replace(/^\/+/, "")}` : "");
        return src ? { src, alt: textOnly(entry?.alt || "") } : null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function parseHentaireadChapter(html, url) {
  const title = textOnly(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const pages = extractHentaireadChapterImages(html);
  if (!pages.length) {
    for (const tag of html.matchAll(/<img[^>]*class="[^"]*chapter-image[^"]*"[^>]*>/gi)) {
      const src = normalizeAssetUrl(tag[0].match(/(?:src|data-src)=["']([^"']+)["']/i)?.[1] ?? "");
      if (src && !pages.some((page) => page.src === src)) {
        pages.push({ src, alt: title });
      }
    }
  }
  return { title, url, pages };
}

function parseHentaireadManga(html, url) {
  const title = textOnly(
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)"/i)?.[1]
    ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? "",
  );
  const cover = normalizeAssetUrl(
    html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)"/i)?.[1]
    ?? html.match(/<img[^>]*class="[^"]*summary_image[^"]*"[^>]*src=["']([^"']+)"/i)?.[1]
    ?? "",
  );
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
    return resolveImage(assertHentaireadImageUrl(requestUrl.searchParams.get("url") ?? ""));
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
    if (genre && !/^[\p{L}\p{N}+_%.\-]+$/u.test(genre)) throw new Error("تصنيف HentaiRead غير صالح");
    if (tag && !/^[\p{L}\p{N}+_%.\-]+$/u.test(tag)) throw new Error("وسم HentaiRead غير صالح");
    const html = await resolveHtml(buildCatalogTarget({ page, genre, tag }));
    const items = parseHentaireadCatalog(html);
    return responseJson(200, {
      items,
      page,
      genre,
      tag,
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
    if (genre || tag) {
      const html = await resolveHtml(buildCatalogTarget({ page, genre, tag }));
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
    const html = await resolveHtml(target);
    return responseJson(200, parseHentaireadChapter(html, target));
  }

  return responseJson(404, { error: "Route HentaiRead inconnue" });
}
