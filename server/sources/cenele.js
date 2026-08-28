import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, recentChaptersFromCount } from "../lib/catalogChapters.js";

const BASE_URL = "https://cenele.com";
const SOURCE_NAME = "Cenele";
const SOURCE_ID = "cenele";
const AJAX_URL = `${BASE_URL}/wp-admin/admin-ajax.php`;
const CATALOG_PATH = "/cont/";

const fetchCeneleHtml = createCachedHtmlFetcher({
  ttlMs: 3 * 60_000,
  timeoutMs: 35_000,
  headers: {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "ar,en;q=0.8",
    referer: `${BASE_URL}/`,
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  },
  getVariants: (url) => [url],
  buildError: (lastStatus) => `Cenele a répondu ${lastStatus || "sans réponse"}`,
});

function assertCeneleHost(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !["cenele.com", "www.cenele.com"].includes(url.hostname)) {
    throw new Error("المصدر غير مسموح");
  }
  url.hostname = "cenele.com";
  url.hash = "";
  return url;
}

function assertCeneleImageUrl(rawUrl) {
  const url = assertCeneleHost(rawUrl);
  if (!url.pathname.startsWith("/wp-content/uploads/")) throw new Error("رابط الصورة غير مسموح");
  return url.toString();
}

function assertNovelUrl(rawUrl) {
  const url = assertCeneleHost(rawUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "cont" || parts.length !== 2) throw new Error("رابط Cenele غير صالح");
  return url.toString();
}

function assertChapterUrl(rawUrl) {
  const url = assertCeneleHost(rawUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "cont" || parts.length < 4) throw new Error("رابط فصل Cenele غير صالح");
  return url.toString();
}

function slugFromNovelUrl(rawUrl) {
  const url = assertCeneleHost(rawUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "cont" && parts[1]) return parts[1];
  throw new Error("رابط Cenele غير صالح");
}

function extractJsonConfig(html, key) {
  const match = html.match(new RegExp(`${key}\\s*=\\s*(\\{[\\s\\S]*?\\});`));
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function chapterNumberFromText(text = "") {
  const match = textOnly(text).match(/(?:الفصل|Chapter)\s*([0-9]+(?:\.[0-9]+)?)/i);
  return match ? match[1] : "";
}

function chapterNumberFromUrl(url = "") {
  const decoded = decodeURIComponent(url);
  const match = decoded.match(/(?:الفصل|chapter)[-_]([0-9]+(?:\.[0-9]+)?)/i);
  return match ? match[1] : "";
}

function resolveMediaType(title = "") {
  const normalized = textOnly(title);
  if (/مانهوا|مانغا|manhwa|manga/i.test(normalized)) {
    return { mediaType: "manga", mediaTypeLabel: "مانهوا" };
  }
  return { mediaType: "novel", mediaTypeLabel: "رواية" };
}

function parseChapterCount(block = "") {
  const chip = block.match(/<span[^>]*class="[^"]*nhv-library-card__chip[^"]*"[^>]*>[\s\S]*?(\d[\d,]*)\s*فصل/i);
  return Number((chip?.[1] ?? "").replace(/,/g, "")) || 0;
}

function buildCeneleChapterUrl(novelUrl, chapterNumber) {
  const slug = slugFromNovelUrl(novelUrl);
  if (!slug || !chapterNumber) return null;
  return `${BASE_URL}/cont/${slug}/vol/الفصل-${chapterNumber}/`;
}

export function parseCeneleCatalog(html) {
  const results = [];
  const starts = [...html.matchAll(/<article[^>]*class="[^"]*nhv-library-card[^"]*"[^>]*>/gi)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const link = block.match(/<h2[^>]*class="[^"]*nhv-library-card__title[^"]*"[^>]*>[\s\S]*?<a[^>]*href="(https?:\/\/(?:www\.)?cenele\.com\/cont\/[^"?#]+\/?)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) return;
    const url = link[1].replace("www.cenele.com", "cenele.com");
    const title = textOnly(link[2]);
    if (!title) return;
    const imageTag = block.match(/<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*>/i)?.[0] ?? block.match(/<img[^>]*>/i)?.[0] ?? "";
    const cover = decodeHtml(imageTag.match(/src="([^"]+)"/i)?.[1] ?? "");
    const excerpt = textOnly(block.match(/<p[^>]*class="[^"]*nhv-library-card__excerpt[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const chapterCount = parseChapterCount(block);
    const recentChapters = recentChaptersFromCount(chapterCount, (number) => buildCeneleChapterUrl(url, number));
    const media = resolveMediaType(title);
    results.push(applyRecentChapterFields({
      id: slugFromNovelUrl(url),
      title,
      altTitle: "",
      url,
      cover,
      summary: excerpt,
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      ...media,
    }, recentChapters));
  });
  return results;
}

export function parseCeneleChapterRows(html) {
  const chapters = [];
  const seen = new Set();
  for (const match of html.matchAll(/<li[^>]*data-chapter-id="(\d+)"[^>]*class="[^"]*wp-manga-chapter[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)) {
    const block = match[2];
    const link = block.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const url = decodeHtml(link[1]).replace("www.cenele.com", "cenele.com");
    if (seen.has(url)) continue;
    seen.add(url);
    const nameHtml = link[2];
    const subName = textOnly(nameHtml.match(/<span[^>]*class="[^"]*nhv-chapter-name[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const mainName = textOnly(nameHtml.replace(/<span[^>]*class="[^"]*nhv-chapter-name[^"]*"[\s\S]*?<\/span>/gi, ""));
    const number = chapterNumberFromText(mainName) || chapterNumberFromUrl(url);
    const name = subName ? `${mainName.trim()} · ${subName}` : mainName.trim();
    const date = textOnly(block.match(/<span[^>]*class="[^"]*chapter-release-date[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    chapters.push({
      url,
      name: name || number,
      number: number || name,
      date,
      locked: /is-locked|nhv-chapter-locked|vip-only/i.test(block),
    });
  }
  return chapters;
}

function parseCeneleTaxonomies(html) {
  const categories = [];
  const tags = [];
  const seenCategories = new Set();
  const seenTags = new Set();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    if (!href) continue;
    let target;
    try {
      target = new URL(href, BASE_URL);
    } catch {
      continue;
    }
    if (target.hostname !== "cenele.com") continue;
    const parts = target.pathname.split("/").filter(Boolean);
    const label = textOnly(match[2]).replace(/^#/, "").trim();
    if (!label || label.length > 60) continue;
    if (parts[0] === "cont-genre" && parts[1]) {
      const key = label.toLocaleLowerCase("ar");
      if (seenCategories.has(key)) continue;
      seenCategories.add(key);
      categories.push(label);
    } else if (parts[0] === "cont-tag" && parts[1]) {
      const key = label.toLocaleLowerCase("ar");
      if (seenTags.has(key)) continue;
      seenTags.add(key);
      tags.push(label);
    }
  }
  return { categories: categories.slice(0, 30), tags: tags.slice(0, 40) };
}

function parseCeneleFilterLinks(html) {
  const categories = [];
  const tags = [];
  const seen = { category: new Set(), tag: new Set() };
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    if (!href) continue;
    let target;
    try {
      target = new URL(href, BASE_URL);
    } catch {
      continue;
    }
    if (target.hostname !== "cenele.com") continue;
    const parts = target.pathname.split("/").filter(Boolean);
    const type = parts[0] === "cont-genre" ? "category" : parts[0] === "cont-tag" ? "tag" : "";
    if (!type || !parts[1]) continue;
    const slug = decodeURIComponent(parts[1]);
    const name = textOnly(match[2]).replace(/^#/, "").trim();
    const key = `${type}:${slug}:${name.toLocaleLowerCase("ar")}`;
    if (!name || seen[type].has(key)) continue;
    seen[type].add(key);
    const entry = { slug, name, count: 0, filterPath: target.pathname.endsWith("/") ? target.pathname : `${target.pathname}/` };
    (type === "category" ? categories : tags).push(entry);
  }
  return { categories, tags };
}

function mergeFilterGroups(groups, limit = 60) {
  const merged = { categories: new Map(), tags: new Map() };
  for (const group of groups) {
    for (const type of ["categories", "tags"]) {
      for (const entry of group[type] || []) {
        const key = entry.name.toLocaleLowerCase("ar");
        if (!merged[type].has(key)) merged[type].set(key, entry);
      }
    }
  }
  return {
    categories: [...merged.categories.values()].slice(0, limit),
    tags: [...merged.tags.values()].slice(0, limit),
  };
}

async function getCeneleAjax(params) {
  const url = new URL(AJAX_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      referer: `${BASE_URL}${CATALOG_PATH}`,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "x-requested-with": "XMLHttpRequest",
    },
    signal: AbortSignal.timeout(35_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.data?.message || data?.message || `Cenele AJAX ${response.status}`);
  }
  return data;
}

async function postCeneleAjax(params) {
  const body = new URLSearchParams(params);
  const response = await fetch(AJAX_URL, {
    method: "POST",
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      referer: `${BASE_URL}${CATALOG_PATH}`,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "x-requested-with": "XMLHttpRequest",
    },
    body,
    signal: AbortSignal.timeout(35_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.data?.message || data?.message || `Cenele AJAX ${response.status}`);
  }
  return data;
}

async function fetchLibraryAjaxConfig() {
  const html = await fetchCeneleHtml(`${BASE_URL}${CATALOG_PATH}`);
  const config = extractJsonConfig(html, "nhvLibrary") || {};
  return { nonce: config.nonce || "", ajaxUrl: config.ajaxUrl || AJAX_URL };
}

async function fetchNovelAjaxConfig(novelUrl) {
  const html = await fetchCeneleHtml(novelUrl);
  const config = extractJsonConfig(html, "nhvNovelV2") || {};
  return {
    postId: String(config.postId || ""),
    chaptersNonce: config.chaptersNonce || "",
    nonce: config.nonce || "",
    html,
  };
}

export async function fetchCeneleChapters(mangaId, chaptersNonce) {
  const chapters = [];
  const seen = new Set();
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= 40) {
    const data = await postCeneleAjax({
      action: "nhv_manga_single_chapters_page",
      manga_id: mangaId,
      nonce: chaptersNonce,
      page: String(page),
      order: "desc",
    });
    for (const chapter of parseCeneleChapterRows(data.html || "")) {
      if (seen.has(chapter.url)) continue;
      seen.add(chapter.url);
      chapters.push(chapter);
    }
    hasMore = Boolean(data.has_more);
    page += 1;
  }
  return chapters;
}

export function parseCeneleDetails(html, url, chapters = []) {
  const slug = slugFromNovelUrl(url);
  const title = textOnly(html.match(/<h1[^>]*class="[^"]*nhv-novel-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1] ?? "");
  const coverTag = html.match(/<div[^>]*class="[^"]*nhv-novel-cover[^"]*"[^>]*>[\s\S]*?<img[^>]*>/i)?.[0] ?? "";
  const cover = decodeHtml(coverTag.match(/src="([^"]+)"/i)?.[1] ?? html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ?? "");
  const synopsisBlock = html.match(/<div[^>]*class="[^"]*nhv-novel-synopsis[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? "";
  const summary = textOnly(synopsisBlock.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, ""));
  const postId = html.match(/post-(\d+)/i)?.[1] ?? "";
  const media = resolveMediaType(title);
  const taxonomies = parseCeneleTaxonomies(html);
  const sorted = [...chapters].sort((a, b) => Number(b.number) - Number(a.number));
  const latest = sorted[0];
  return {
    id: slug,
    novelId: Number(postId) || null,
    title,
    altTitle: "",
    cover,
    summary,
    url,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    ...media,
    ...taxonomies,
    chapters: sorted,
    latestChapter: latest?.number ?? "—",
    latestChapterUrl: latest?.url ?? null,
    recentChapters: sorted.slice(0, 2),
  };
}

export function parseCeneleChapter(html, url) {
  const title = textOnly(
    html.match(/<h3[^>]*class="[^"]*chapter-name[^"]*"[^>]*>([\s\S]*?)<\/h3>/i)?.[1]
      ?? html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.split("|")[0]
      ?? "فصل",
  );
  const contentStart = html.search(/<div[^>]*class="[^"]*reading-content[^"]*"[^>]*>/i);
  if (contentStart < 0) throw new Error("تعذر استخراج محتوى الفصل");
  const tail = html.slice(contentStart);
  const endMarker = tail.search(/<aside[^>]*class="[^"]*nhv-reader-store|<div[^>]*id="nhv-reading-bottom"|<\/article>/i);
  const block = endMarker > 0 ? tail.slice(0, endMarker) : tail.slice(0, 120_000);
  const cleaned = block.replace(/<div[^>]*class="[^"]*nhv-reading-chapter-head[^"]*"[\s\S]*?<\/div>\s*(?=<)/i, "");
  const paragraphs = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => textOnly(match[1]))
    .filter((text) => text && text.length > 1 && !/اختر المظهر/i.test(text));
  if (!paragraphs.length) throw new Error("تعذر استخراج محتوى الفصل");
  return {
    title,
    url,
    kind: "novel",
    paragraphs,
    pages: [],
  };
}

function buildCatalogUrl(page, filterPath = CATALOG_PATH) {
  const normalized = filterPath.startsWith("/") ? filterPath : `/${filterPath}`;
  if (page <= 1) return `${BASE_URL}${normalized}`;
  const trimmed = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  return `${BASE_URL}${trimmed}/page/${page}/`;
}

function catalogHasMore(html, page, filterPath = CATALOG_PATH) {
  const trimmed = (filterPath.startsWith("/") ? filterPath : `/${filterPath}`).replace(/\/$/, "");
  return new RegExp(`${trimmed}/page/${page + 1}`, "i").test(html)
    || new RegExp(`${trimmed}/page/${page + 1}/`, "i").test(html);
}

async function searchCeneleCatalog(query) {
  const { nonce } = await fetchLibraryAjaxConfig();
  const data = await getCeneleAjax({
    action: "nhv_manga_suggest",
    term: query,
    nonce,
  });
  const items = (data.data?.items || data.items || []).map((entry) => {
    const url = String(entry.url || "").replace("www.cenele.com", "cenele.com");
    if (!url) return null;
    const title = textOnly(entry.title || "");
    const media = resolveMediaType(title);
    return {
      id: slugFromNovelUrl(url),
      title,
      altTitle: "",
      url,
      cover: entry.thumb || "",
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      ...media,
      latestChapter: "—",
      latestChapterUrl: null,
      recentChapters: [],
    };
  }).filter(Boolean);
  return items;
}

export async function handleCeneleRequest(requestUrl) {
  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(assertCeneleImageUrl(requestUrl.searchParams.get("url") ?? ""), `${BASE_URL}/`, SOURCE_NAME);
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const html = await fetchCeneleHtml(`${BASE_URL}${CATALOG_PATH}`);
    return responseJson(200, { ...mergeFilterGroups([parseCeneleFilterLinks(html)]), fetchedAt: new Date().toISOString() });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const filterPath = requestUrl.searchParams.get("filterPath")?.trim() || CATALOG_PATH;
    if (!/^\/[\p{L}\p{N}/+_.%-]+\/?$/u.test(filterPath) || filterPath.includes("..")) {
      throw new Error("مسار فلتر Cenele غير صالح");
    }
    const html = await fetchCeneleHtml(buildCatalogUrl(page, filterPath));
    const items = parseCeneleCatalog(html);
    return responseJson(200, {
      items,
      page,
      hasMore: catalogHasMore(html, page, filterPath),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const items = await searchCeneleCatalog(query);
    return responseJson(200, { items });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertNovelUrl(requestUrl.searchParams.get("url") ?? "");
    const { postId, chaptersNonce, html } = await fetchNovelAjaxConfig(target);
    let chapters = parseCeneleChapterRows(html);
    if (postId && chaptersNonce) {
      try {
        chapters = await fetchCeneleChapters(postId, chaptersNonce);
      } catch {
        // Garde les chapitres récents rendus dans la page.
      }
    }
    return responseJson(200, parseCeneleDetails(html, target, chapters));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertChapterUrl(requestUrl.searchParams.get("url") ?? "");
    const html = await fetchCeneleHtml(target);
    return responseJson(200, parseCeneleChapter(html, target));
  }

  return responseJson(404, { error: "Route Cenele inconnue" });
}
