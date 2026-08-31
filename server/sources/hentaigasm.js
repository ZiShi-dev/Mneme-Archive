import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { fetchProxiedMediaBytes, pickHeader } from "../lib/hlsProxy.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, normalizeRecentChapters } from "../lib/catalogChapters.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";
import { configureSourceNativeFetch, fetchNativeImage } from "../lib/nativeFetchBridge.js";
import { isCloudflareChallengeHtml } from "../lib/cloudflareDetect.js";

const DEFAULT_BASE_URL = "https://hentaigasm.com";
const SOURCE_NAME = "HentaiGasm";
const SOURCE_ID = "hentaigasm";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
const HOST_PATTERN = /(?:^|\.)hentaigasm\.com$/i;
const CDN_HOST_PATTERN = /(?:^|\.)hgasm[123]\.com$/i;
const FILTER_SLUG_PATTERN = /^[\p{L}\p{N}+_%.\-]+$/u;
/** Plafond pour un GET complet sans Range (DoS) ; les plages Range restent limitées par le CDN. */
const MAX_STREAM_BYTES = 512 * 1024 * 1024;
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export function configureHentaigasmNativeFetch(options) {
  configureSourceNativeFetch(options);
}

function createFetcher(baseUrl = DEFAULT_BASE_URL) {
  return createCachedHtmlFetcher({
    ttlMs: 3 * 60_000,
    timeoutMs: 40_000,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en,ar;q=0.8",
      referer: `${baseUrl}/`,
      "user-agent": BROWSER_UA,
    },
    getVariants: (url) => [url],
    buildError: (lastStatus) => (lastStatus === 403
      ? "حماية HentaiGasm المؤقتة منعت الاتصال، أعد المحاولة بعد قليل"
      : `HentaiGasm a répondu ${lastStatus || "sans réponse"}`),
    preferFlareSolverr: true,
  });
}

async function resolveHtml(url, fetchHtmlRemote) {
  const html = await fetchHtmlRemote(url);
  if (isCloudflareChallengeHtml(html)) {
    throw new Error("حماية HentaiGasm المؤقتة منعت الاتصال (Cloudflare)");
  }
  return html;
}

async function fetchJson(baseUrl, path, { searchParams = {} } = {}) {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/wp-json/wp/v2/${path}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== "" && value != null) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      referer: `${baseUrl}/`,
      "user-agent": BROWSER_UA,
    },
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) throw new Error(`HentaiGasm API ${response.status}`);
  const data = await response.json();
  const totalPages = Number(response.headers.get("x-wp-totalpages") || 0);
  const total = Number(response.headers.get("x-wp-total") || 0);
  return { data, totalPages, total };
}

export function isAllowedHentaigasmAssetHost(hostname = "") {
  const host = String(hostname || "").toLowerCase();
  return HOST_PATTERN.test(host) || CDN_HOST_PATTERN.test(host);
}

function isAllowedHentaigasmImagePath(pathname = "") {
  const path = String(pathname || "");
  if (path.startsWith("/preview/")) return true;
  if (path.startsWith("/thumbnail/")) return true;
  if (path.startsWith("/wp-content/")) return true;
  return /\.(?:webp|jpe?g|png|avif|gif)$/i.test(path);
}

export function normalizeHentaigasmAssetUrl(rawUrl = "", { requireMp4 = false } = {}) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return "";
  try {
    const encoded = requireMp4 ? encodeURI(decodeHtml(trimmed)) : decodeHtml(trimmed);
    const url = new URL(encoded);
    if (url.protocol !== "https:" || !isAllowedHentaigasmAssetHost(url.hostname)) return "";
    url.hash = "";
    if (requireMp4 && !/\.mp4(?:$|\?)/i.test(url.pathname)) return "";
    if (!requireMp4 && !isAllowedHentaigasmImagePath(url.pathname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function extractHentaigasmVideoUrl(html = "") {
  const match = String(html).match(/file:\s*["'](https?:\/\/[^"']+\.mp4)["']/i)
    ?? String(html).match(/href=["'](https?:\/\/[^"']+\.mp4)["'][^>]*download/i);
  if (!match?.[1]) return "";
  return normalizeHentaigasmAssetUrl(match[1], { requireMp4: true });
}

export function extractHentaigasmCover(html = "", title = "") {
  const fromPlayer = String(html).match(/image:\s*["'](https?:\/\/[^"']+)["']/i)?.[1];
  const playerCover = normalizeHentaigasmAssetUrl(fromPlayer || "");
  if (playerCover) return playerCover;
  const fromThumb = String(html).match(/<img[^>]*class="[^"]*thumb[^"]*"[^>]*src=["']([^"']+)["']/i)?.[1];
  const thumbCover = normalizeHentaigasmAssetUrl(fromThumb || "");
  if (thumbCover) return thumbCover;
  const safeTitle = String(title || "").trim();
  if (!safeTitle) return "";
  return `https://hgasm1.com/preview/${encodeURIComponent(safeTitle)}.jpg`;
}

function assertHentaigasmUrl(rawUrl, ctx = DEFAULT_CTX) {
  let url;
  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("المصدر غير مسموح");
  }
  if (url.protocol !== "https:" || !ctx.hostPattern.test(url.hostname)) {
    throw new Error("المصدر غير مسموح");
  }
  url.hostname = ctx.apex;
  url.hash = "";
  return url.toString();
}

function assertHentaigasmImageUrl(rawUrl) {
  const normalized = normalizeHentaigasmAssetUrl(rawUrl);
  if (!normalized) throw new Error("رابط الصورة غير مسموح");
  return normalized;
}

function assertHentaigasmStreamUrl(rawUrl) {
  const normalized = normalizeHentaigasmAssetUrl(rawUrl, { requireMp4: true });
  if (!normalized) throw new Error("رابط الفيديو غير مسموح");
  return normalized;
}

function assertFilterSlug(value, label) {
  const slug = String(value || "").trim();
  if (!slug) return "";
  if (!FILTER_SLUG_PATTERN.test(slug)) throw new Error(label);
  return slug;
}

function stripHtml(value = "") {
  return textOnly(String(value).replace(/<[^>]+>/g, " "));
}

function mapPostToCatalogItem(post) {
  const title = stripHtml(post?.title?.rendered || "");
  const url = post?.link || "";
  const content = post?.content?.rendered || "";
  const cover = extractHentaigasmCover(content, title);
  const chapters = normalizeRecentChapters([{
    url: post.link,
    name: title || "1",
    number: "1",
    date: post.date || "",
    publishedAt: post.date || "",
  }]);
  return applyRecentChapterFields({
    id: String(post?.id || ""),
    title,
    url,
    cover,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "anime",
    mediaTypeLabel: "أنمي",
    publicationStatus: "completed",
    catalogStyle: "standalone",
  }, chapters);
}

function mapPostToChapter(post, index = 1, total = 1) {
  const title = stripHtml(post?.title?.rendered || "");
  const content = post?.content?.rendered || "";
  const videoUrl = extractHentaigasmVideoUrl(content);
  return {
    url: post.link,
    name: title || String(index),
    number: String(total - index + 1),
    date: post.date || "",
    publishedAt: post.date ? new Date(post.date).toISOString() : "",
    videoUrl,
    streamUrl: videoUrl,
  };
}

export function parseHentaigasmCatalogFromPosts(posts = []) {
  return posts.map((post) => mapPostToCatalogItem(post));
}

async function resolveTaxonomyId(baseUrl, taxonomy, slug) {
  const endpoint = taxonomy === "tag" ? "tags" : "categories";
  const { data } = await fetchJson(baseUrl, endpoint, { searchParams: { search: slug, per_page: 20 } });
  const match = (data || []).find((entry) => entry.slug === slug);
  return match?.id || 0;
}

async function fetchPosts(baseUrl, { page = 1, genre = "", series = "" } = {}) {
  const searchParams = { per_page: 20, page };
  if (genre) {
    const tagId = await resolveTaxonomyId(baseUrl, "tag", genre);
    if (tagId) searchParams.tags = String(tagId);
  }
  if (series) {
    const categoryId = await resolveTaxonomyId(baseUrl, "category", series);
    if (categoryId) searchParams.categories = String(categoryId);
  }
  return fetchJson(baseUrl, "posts", { searchParams });
}

export function parseHentaigasmChapterFromHtml(html, url, { baseUrl = DEFAULT_BASE_URL } = {}) {
  const title = textOnly(
    html.match(/<h1[^>]*id=["']title["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? html.match(/<title[^>]*>([^<]+)/i)?.[1]?.split("|")[0]
    ?? "",
  );
  const videoUrl = extractHentaigasmVideoUrl(html);
  const sources = videoUrl
    ? [{
      label: "MP4",
      url: "",
      streamUrl: videoUrl,
      streamReferer: `${baseUrl}/`,
      streamType: "mp4",
    }]
    : [];
  return {
    kind: "video",
    title,
    url,
    videoUrl,
    streamUrl: videoUrl,
    streamReferer: `${baseUrl}/`,
    streamType: videoUrl ? "mp4" : "",
    playbackMode: videoUrl ? "video" : undefined,
    sources,
    pages: [],
  };
}

async function resolveDetails(url, ctx, fetchHtml) {
  const parsed = new URL(url);
  const slug = parsed.pathname.split("/").filter(Boolean).pop() || "";
  const { data } = await fetchJson(ctx.baseUrl, "posts", {
    searchParams: { slug, per_page: 1, _embed: "1" },
  });
  const post = data[0];
  if (!post) throw new Error("تعذر العثور على الحلقة");
  const title = stripHtml(post.title?.rendered || "");
  const content = post.content?.rendered || "";
  let cover = extractHentaigasmCover(content, title);
  if (!cover) {
    try {
      const html = await resolveHtml(url, fetchHtml);
      cover = extractHentaigasmCover(html, title);
    } catch {
      // Keep empty cover if HTML fallback fails.
    }
  }
  let chapters = [mapPostToChapter(post, 1, 1)];
  const categoryId = post.categories?.[0];
  if (categoryId) {
    const siblings = await fetchJson(ctx.baseUrl, "posts", {
      searchParams: { categories: String(categoryId), per_page: 100, orderby: "date", order: "asc" },
    });
    if (siblings.data.length > 1) {
      chapters = siblings.data.map((entry, index, list) => mapPostToChapter(entry, index, list.length));
    }
  }
  const genres = [];
  const tags = [];
  if (Array.isArray(post._embedded?.["wp:term"])) {
    for (const group of post._embedded["wp:term"]) {
      for (const term of group || []) {
        if (term.taxonomy === "category") tags.push(term.name);
        if (term.taxonomy === "post_tag") genres.push(term.name);
      }
    }
  }
  return enrichSourceDetails({
    id: String(post.id),
    title,
    cover,
    summary: stripHtml(post.excerpt?.rendered || ""),
    url: post.link,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "anime",
    mediaTypeLabel: "أنمي",
    publicationStatus: "completed",
    categories: genres,
    tags,
    chapters,
  }, { parser: "wordpress-rest" });
}

export async function handleHentaigasmRequest(requestUrl, request = {}) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: SOURCE_NAME });
  const fetchHtmlRemote = createFetcher(ctx.baseUrl);
  const { baseUrl } = ctx;

  if (requestUrl.pathname.endsWith("/image")) {
    const target = assertHentaigasmImageUrl(requestUrl.searchParams.get("url") ?? "");
    return fetchNativeImage(target, () => fetchProxiedImage(target, `${baseUrl}/`, SOURCE_NAME));
  }

  if (requestUrl.pathname.endsWith("/stream")) {
    const target = assertHentaigasmStreamUrl(requestUrl.searchParams.get("url") ?? "");
    const referer = (() => {
      try {
        return assertHentaigasmUrl(requestUrl.searchParams.get("referer") ?? baseUrl, ctx);
      } catch {
        return `${baseUrl}/`;
      }
    })();
    return fetchProxiedMediaBytes({
      target,
      referer,
      label: SOURCE_NAME,
      range: pickHeader(request.headers, "range"),
      method: String(request.method || "GET").toUpperCase(),
      maxBytes: MAX_STREAM_BYTES,
    });
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const [tags, categories] = await Promise.all([
      fetchJson(baseUrl, "tags", { searchParams: { per_page: 100, orderby: "count", order: "desc" } }),
      fetchJson(baseUrl, "categories", { searchParams: { per_page: 100, orderby: "count", order: "desc" } }),
    ]);
    return responseJson(200, {
      categories: (tags.data || []).map((entry) => ({
        slug: entry.slug,
        name: stripHtml(entry.name),
        count: entry.count || 0,
      })),
      tags: (categories.data || []).map((entry) => ({
        slug: entry.slug,
        name: stripHtml(entry.name),
        count: entry.count || 0,
        archivePath: "series",
      })),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = assertFilterSlug(requestUrl.searchParams.get("genre"), "تصنيف HentaiGasm غير صالح");
    const tag = assertFilterSlug(requestUrl.searchParams.get("tag"), "سلسلة HentaiGasm غير صالحة");
    const { data, totalPages } = await fetchPosts(baseUrl, { page, genre, series: tag });
    return responseJson(200, {
      items: parseHentaigasmCatalogFromPosts(data),
      page,
      genre,
      tag,
      hasMore: page < totalPages,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = assertFilterSlug(requestUrl.searchParams.get("genre"), "تصنيف HentaiGasm غير صالح");
    const tag = assertFilterSlug(requestUrl.searchParams.get("tag"), "سلسلة HentaiGasm غير صالحة");
    if (genre || tag) {
      const { data, totalPages } = await fetchPosts(baseUrl, { page, genre, series: tag });
      const needle = query.toLocaleLowerCase("en");
      const items = parseHentaigasmCatalogFromPosts(data).filter((item) => (
        item.title.toLocaleLowerCase("en").includes(needle)
      ));
      return responseJson(200, {
        items,
        page,
        hasMore: page < totalPages,
      });
    }
    const { data, totalPages } = await fetchJson(baseUrl, "posts", {
      searchParams: { search: query, per_page: 20, page },
    });
    return responseJson(200, {
      items: parseHentaigasmCatalogFromPosts(data),
      page,
      hasMore: page < totalPages,
    });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertHentaigasmUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    return responseJson(200, await resolveDetails(target, ctx, fetchHtmlRemote));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertHentaigasmUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    const html = await resolveHtml(target, fetchHtmlRemote);
    let chapter = parseHentaigasmChapterFromHtml(html, target, { baseUrl });
    if (!chapter.videoUrl) {
      const slug = new URL(target).pathname.split("/").filter(Boolean).pop() || "";
      const { data } = await fetchJson(baseUrl, "posts", { searchParams: { slug, per_page: 1 } });
      const post = data[0];
      if (post) {
        chapter = parseHentaigasmChapterFromHtml(post.content?.rendered || "", target, { baseUrl });
        chapter.title = chapter.title || stripHtml(post.title?.rendered || "");
      }
    }
    return responseJson(200, chapter);
  }

  return responseJson(404, { error: "Route HentaiGasm inconnue" });
}
