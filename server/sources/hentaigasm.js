import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields } from "../lib/catalogChapters.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";

const BASE_URL = "https://hentaigasm.com";
const API_URL = `${BASE_URL}/wp-json/wp/v2`;
const SOURCE_NAME = "HentaiGasm";
const SOURCE_ID = "hentaigasm";
const HOST_PATTERN = /(?:^|\.)hentaigasm\.com$/i;
const CDN_HOST_PATTERN = /(?:^|\.)hgasm[123]\.com$/i;
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const fetchHtml = createCachedHtmlFetcher({
  ttlMs: 3 * 60_000,
  timeoutMs: 35_000,
  headers: {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en,ar;q=0.8",
    referer: `${BASE_URL}/`,
    "user-agent": BROWSER_UA,
  },
  getVariants: (url) => [url],
  buildError: (lastStatus) => `HentaiGasm a répondu ${lastStatus || "sans réponse"}`,
});

async function fetchJson(path, { searchParams = {} } = {}) {
  const url = new URL(`${API_URL}/${path}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== "" && value != null) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      referer: `${BASE_URL}/`,
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

export function extractHentaigasmVideoUrl(html = "") {
  const match = String(html).match(/file:\s*["'](https?:\/\/[^"']+\.mp4)["']/i)
    ?? String(html).match(/href=["'](https?:\/\/[^"']+\.mp4)["'][^>]*download/i);
  return match?.[1] ? decodeHtml(match[1]) : "";
}

export function extractHentaigasmCover(html = "", title = "") {
  const fromPlayer = String(html).match(/image:\s*["'](https?:\/\/[^"']+)["']/i)?.[1];
  if (fromPlayer) return decodeHtml(fromPlayer);
  const fromThumb = String(html).match(/<img[^>]*class="[^"]*thumb[^"]*"[^>]*src=["']([^"']+)["']/i)?.[1];
  if (fromThumb) return decodeHtml(fromThumb);
  const safeTitle = String(title || "").trim();
  if (!safeTitle) return "";
  return `https://hgasm1.com/preview/${encodeURIComponent(safeTitle)}.jpg`;
}

function assertHentaigasmUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !HOST_PATTERN.test(url.hostname)) throw new Error("المصدر غير مسموح");
  url.hostname = "hentaigasm.com";
  return url.toString();
}

function assertHentaigasmImageUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("رابط الصورة غير مسموح");
  if (!HOST_PATTERN.test(url.hostname) && !CDN_HOST_PATTERN.test(url.hostname)) {
    throw new Error("رابط الصورة غير مسموح");
  }
  return url.toString();
}

function stripHtml(value = "") {
  return textOnly(String(value).replace(/<[^>]+>/g, " "));
}

function mapPostToCatalogItem(post) {
  const title = stripHtml(post?.title?.rendered || "");
  const url = post?.link || "";
  const content = post?.content?.rendered || "";
  const cover = extractHentaigasmCover(content, title);
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
  }, normalizeRecentChaptersFromPosts([post]));
}

function normalizeRecentChaptersFromPosts(posts = []) {
  return posts.slice(0, 2).map((post, index) => ({
    url: post.link,
    name: stripHtml(post.title?.rendered || String(index + 1)),
    number: String(posts.length - index),
    date: post.date || "",
    publishedAt: post.date || "",
  }));
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

async function resolveTaxonomyId(taxonomy, slug) {
  const endpoint = taxonomy === "tag" ? "tags" : "categories";
  const { data } = await fetchJson(endpoint, { searchParams: { search: slug, per_page: 20 } });
  const match = data.find((entry) => entry.slug === slug) || data[0];
  return match?.id || 0;
}

async function fetchPosts({ page = 1, genre = "", series = "" } = {}) {
  const searchParams = { per_page: 20, page };
  if (genre) {
    const tagId = await resolveTaxonomyId("tag", genre);
    if (tagId) searchParams.tags = String(tagId);
  }
  if (series) {
    const categoryId = await resolveTaxonomyId("category", series);
    if (categoryId) searchParams.categories = String(categoryId);
  }
  return fetchJson("posts", { searchParams });
}

export function parseHentaigasmChapterFromHtml(html, url) {
  const title = textOnly(html.match(/<h1[^>]*id=["']title["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const videoUrl = extractHentaigasmVideoUrl(html);
  return {
    kind: "video",
    title,
    url,
    videoUrl,
    streamUrl: videoUrl,
    streamReferer: `${BASE_URL}/`,
    pages: [],
  };
}

async function resolveDetails(url) {
  const parsed = new URL(url);
  const slug = parsed.pathname.split("/").filter(Boolean).pop() || "";
  const { data } = await fetchJson("posts", { searchParams: { slug, per_page: 1 } });
  const post = data[0];
  if (!post) throw new Error("تعذر العثور على الحلقة");
  const title = stripHtml(post.title?.rendered || "");
  const content = post.content?.rendered || "";
  const cover = extractHentaigasmCover(content, title);
  let chapters = [mapPostToChapter(post, 1, 1)];
  const categoryId = post.categories?.[0];
  if (categoryId) {
    const siblings = await fetchJson("posts", {
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
  });
}

export async function handleHentaigasmRequest(requestUrl) {
  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(
      assertHentaigasmImageUrl(requestUrl.searchParams.get("url") ?? ""),
      `${BASE_URL}/`,
      SOURCE_NAME,
    );
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const [tags, categories] = await Promise.all([
      fetchJson("tags", { searchParams: { per_page: 100, orderby: "count", order: "desc" } }),
      fetchJson("categories", { searchParams: { per_page: 100, orderby: "count", order: "desc" } }),
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
        archivePath: "hentai",
      })),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() ?? "";
    const tag = requestUrl.searchParams.get("tag")?.trim() ?? "";
    if (genre && !/^[\p{L}\p{N}+_%.\-]+$/u.test(genre)) throw new Error("تصنيف HentaiGasm غير صالح");
    if (tag && !/^[\p{L}\p{N}+_%.\-]+$/u.test(tag)) throw new Error("سلسلة HentaiGasm غير صالحة");
    const { data, totalPages } = await fetchPosts({ page, genre, series: tag });
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
    const { data, totalPages } = await fetchJson("posts", {
      searchParams: { search: query, per_page: 20, page },
    });
    return responseJson(200, {
      items: parseHentaigasmCatalogFromPosts(data),
      page,
      hasMore: page < totalPages,
    });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertHentaigasmUrl(requestUrl.searchParams.get("url") ?? "");
    return responseJson(200, await resolveDetails(target));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertHentaigasmUrl(requestUrl.searchParams.get("url") ?? "");
    const slug = new URL(target).pathname.split("/").filter(Boolean).pop() || "";
    const { data } = await fetchJson("posts", { searchParams: { slug, per_page: 1 } });
    const post = data[0];
    if (!post) throw new Error("تعذر العثور على الحلقة");
    const content = post.content?.rendered || "";
    const chapter = parseHentaigasmChapterFromHtml(content, target);
    chapter.title = chapter.title || stripHtml(post.title?.rendered || "");
    if (!chapter.videoUrl) {
      const html = await fetchHtml(target);
      return responseJson(200, parseHentaigasmChapterFromHtml(html, target));
    }
    return responseJson(200, chapter);
  }

  return responseJson(404, { error: "Route HentaiGasm inconnue" });
}
