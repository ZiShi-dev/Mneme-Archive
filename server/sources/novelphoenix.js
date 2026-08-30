import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, recentChaptersFromCount } from "../lib/catalogChapters.js";
import { filterNovelParagraphs } from "../lib/novelChapterText.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";

const DEFAULT_BASE_URL = "https://novelphoenix.com";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
const SOURCE_NAME = "Novel Phoenix";
const SOURCE_ID = "novelphoenix";
const FILTERS_CACHE_TTL_MS = 30 * 60_000;
const TAG_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
let filtersCache = null;

function createFetcher(baseUrl = DEFAULT_BASE_URL) {
  return createCachedHtmlFetcher({
    ttlMs: 3 * 60_000,
    timeoutMs: 35_000,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en,ar;q=0.8",
      referer: `${baseUrl}/`,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    getVariants: (url) => [url],
    buildError: (lastStatus) => (lastStatus === 403
      ? "حماية Novel Phoenix تمنع الاتصال (Cloudflare)"
      : `Novel Phoenix a répondu ${lastStatus || "sans réponse"}`),
  });
}

function assertNovelphoenixHost(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("المصدر غير مسموح");
  }
  url.hostname = ctx.apex;
  url.hash = "";
  return url;
}

function assertNovelphoenixImageUrl(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ctx.hostPattern.test(url.hostname)) {
    throw new Error("رابط الصورة غير مسموح");
  }
  if (!/^\/server-\d+\//i.test(url.pathname) && !url.pathname.startsWith("/logo")) {
    throw new Error("رابط الصورة غير مسموح");
  }
  return url.toString();
}

function toAbsoluteUrl(rawUrl = "", baseUrl = DEFAULT_BASE_URL) {
  const cleaned = decodeHtml(String(rawUrl || "")).trim();
  if (!cleaned) return "";
  try {
    const url = new URL(cleaned, baseUrl);
    if (url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function buildNovelUrl(slug, baseUrl = DEFAULT_BASE_URL) {
  return `${baseUrl}/novel/${slug}`;
}

export function buildChapterUrl(slug, chapterNumber, baseUrl = DEFAULT_BASE_URL) {
  return `${baseUrl}/novel/${slug}/chapter-${chapterNumber}`;
}

export function slugFromNovelUrl(rawUrl) {
  const url = assertNovelphoenixHost(rawUrl);
  const match = url.pathname.match(/^\/novel\/([^/]+)\/?$/i);
  if (!match) throw new Error("رابط Novel Phoenix غير صالح");
  return match[1];
}

export function parseChapterTarget(rawUrl) {
  const url = assertNovelphoenixHost(rawUrl);
  const match = url.pathname.match(/^\/novel\/([^/]+)\/chapter-(\d+)\/?$/i);
  if (!match) throw new Error("رابط فصل Novel Phoenix غير صالح");
  return { slug: match[1], chapterNumber: Number(match[2]) };
}

function parseImageUrl(tag = "") {
  const dataSrc = tag.match(/data-src=["']([^"']+)["']/i)?.[1];
  const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
  const candidate = dataSrc || src || "";
  return candidate.startsWith("data:") ? "" : decodeHtml(candidate);
}

export function parseNovelphoenixCatalog(html = "", baseUrl = DEFAULT_BASE_URL) {
  const results = [];
  const seen = new Set();
  const blocks = [...html.matchAll(/<li class="novel-item">([\s\S]*?)<\/li>/gi)];
  for (const match of blocks) {
    const block = match[1];
    const link = block.match(/<a[^>]*href="(\/novel\/[^"/?#]+)"[^>]*(?:title="([^"]*)")?[^>]*>/i);
    if (!link) continue;
    const slug = link[1].split("/").pop();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const title = textOnly(link[2] || block.match(/<h[1-4][^>]*class="[^"]*novel-title[^"]*"[^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1] || "");
    const imageTag = block.match(/<img[^>]*>/i)?.[0] || "";
    const cover = toAbsoluteUrl(parseImageUrl(imageTag), baseUrl);
    const chapterCount = Number(textOnly(block.match(/<div class="novel-stats"[^>]*>[\s\S]*?(\d+)\s*Chapters?/i)?.[1] || "0")) || 0;
    const recentChapters = recentChaptersFromCount(chapterCount, (number) => buildChapterUrl(slug, number, baseUrl));
    results.push(applyRecentChapterFields({
      id: slug,
      title,
      url: buildNovelUrl(slug, baseUrl),
      cover,
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType: "novel",
      mediaTypeLabel: "رواية",
      chapterCount,
    }, recentChapters));
  }
  return results;
}

export function catalogHasMorePages(html = "") {
  return /<li class="page-item">\s*<a class="page-link"[^>]*href="[^"]*page=\d+"/i.test(html)
    && !/<li class="page-item disabled"[^>]*>\s*<a class="page-link"[^>]*href="[^"]*page=\d+"/i.test(html);
}

function parseGenreFilters(html = "") {
  const entries = [];
  const seen = new Set();
  for (const match of html.matchAll(/href="(\/genre-[^/"]+)\/sort-new[^"]*"[^>]*title="([^"]+)"/gi)) {
    const slug = match[1].replace(/^\/genre-/, "");
    if (!slug || slug === "all" || seen.has(slug)) continue;
    seen.add(slug);
    entries.push({ slug, name: textOnly(match[2]), count: 0 });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

function parseTagFilters(html = "") {
  const entries = [];
  const seen = new Set();
  for (const match of html.matchAll(/href="(\/tags\/[^/"]+)\/order-popular"[^>]*>([^<]+)</gi)) {
    const slug = match[1].replace(/^\/tags\//, "");
    const name = textOnly(match[2]);
    if (!slug || !name || seen.has(slug)) continue;
    seen.add(slug);
    entries.push({ slug, name, count: 0 });
  }
  return entries;
}

async function fetchTagFilters(fetchHtml, baseUrl = DEFAULT_BASE_URL) {
  const tags = [];
  const seen = new Set();
  for (let index = 0; index < TAG_LETTERS.length; index += 6) {
    const batch = TAG_LETTERS.slice(index, index + 6);
    const pages = await Promise.all(batch.map((letter) => fetchHtml(`${baseUrl}/all-tags/${letter}`).catch(() => "")));
    for (const html of pages) {
      for (const entry of parseTagFilters(html)) {
        if (seen.has(entry.slug)) continue;
        seen.add(entry.slug);
        tags.push(entry);
      }
    }
  }
  return tags.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

async function fetchFilters(fetchHtml, baseUrl = DEFAULT_BASE_URL) {
  if (filtersCache && filtersCache.baseUrl === baseUrl && Date.now() - filtersCache.at < FILTERS_CACHE_TTL_MS) {
    return filtersCache.data;
  }
  const catalogHtml = await fetchHtml(`${baseUrl}/genre-all/sort-new/status-all/all-novel`);
  const categories = parseGenreFilters(catalogHtml);
  const tags = await fetchTagFilters(fetchHtml, baseUrl);
  const data = { categories, tags };
  if (categories.length || tags.length) {
    filtersCache = { at: Date.now(), baseUrl, data };
  }
  return data;
}

export function buildNovelphoenixCatalogUrl({
  page = 1,
  genre = "",
  tag = "",
  kind = "",
  baseUrl = DEFAULT_BASE_URL,
} = {}) {
  let path = "/genre-all/sort-new/status-all/all-novel";
  if (kind === "popular") path = "/genre-all/sort-popular/status-all/all-novel";
  else if (kind === "updates") path = "/genre-all/sort-latest-release/status-all/all-novel";
  else if (kind === "completed") path = "/genre-all/sort-new/status-completed/all-novel";
  else if (kind === "ongoing") path = "/genre-all/sort-new/status-ongoing/all-novel";
  else if (kind === "ranking") path = "/ranking";
  else if (kind === "latest") path = "/latest-release-novels";

  if (genre) path = `/genre-${genre}/sort-new/status-all/all-novel`;
  if (tag) path = `/tags/${tag}/order-popular`;

  const url = new URL(path, baseUrl);
  if (page > 1) url.searchParams.set("page", String(page));
  return url.toString();
}

export function buildNovelphoenixSearchUrl(query, page = 1, baseUrl = DEFAULT_BASE_URL) {
  const url = new URL("/search", baseUrl);
  url.searchParams.set("keyword", query);
  url.searchParams.set("type", "novel");
  if (page > 1) url.searchParams.set("page", String(page));
  return url.toString();
}

export function parseNovelphoenixChapters(html = "", slug = "", baseUrl = DEFAULT_BASE_URL) {
  const chapters = [];
  const seen = new Set();
  for (const match of html.matchAll(/<li>\s*<a href="(\/novel\/[^"]+\/chapter-\d+)"[^>]*title="([^"]*)"[^>]*>[\s\S]*?<span class="chapter-no">(\d+)<\/span>[\s\S]*?<strong class="chapter-title">([\s\S]*?)<\/strong>/gi)) {
    const url = toAbsoluteUrl(match[1], baseUrl);
    const number = String(match[3] || "");
    if (!url || !number || seen.has(number)) continue;
    seen.add(number);
    chapters.push({
      url,
      number,
      name: textOnly(match[4] || match[2] || number),
      date: textOnly(match[0].match(/datetime="([^"]+)"/i)?.[1] || ""),
      locked: false,
    });
  }
  if (!chapters.length) {
    for (const match of html.matchAll(/<li>\s*<a href="(\/novel\/[^"]+\/chapter-\d+)"[^>]*title="([^"]*)"/gi)) {
      const url = toAbsoluteUrl(match[1], baseUrl);
      const number = url.match(/chapter-(\d+)/i)?.[1] || "";
      if (!url || !number || seen.has(number)) continue;
      seen.add(number);
      chapters.push({
        url,
        number,
        name: textOnly(match[2] || number),
        date: "",
        locked: false,
      });
    }
  }
  return chapters.sort((a, b) => Number(b.number) - Number(a.number));
}

function parseChapterListTotalPages(html = "") {
  const pages = [...html.matchAll(/href="[^"]*\/chapters\?page=(\d+)"/gi)].map((match) => Number(match[1]));
  return pages.length ? Math.max(...pages) : 1;
}

async function fetchAllChapters(slug, fetchHtml, baseUrl = DEFAULT_BASE_URL) {
  const firstHtml = await fetchHtml(`${baseUrl}/novel/${slug}/chapters`);
  const chapters = parseNovelphoenixChapters(firstHtml, slug, baseUrl);
  const totalPages = parseChapterListTotalPages(firstHtml);
  for (let page = 2; page <= totalPages; page += 1) {
    const html = await fetchHtml(`${baseUrl}/novel/${slug}/chapters?page=${page}`);
    chapters.push(...parseNovelphoenixChapters(html, slug, baseUrl));
  }
  const byNumber = new Map();
  for (const chapter of chapters) byNumber.set(chapter.number, chapter);
  return [...byNumber.values()].sort((a, b) => Number(a.number) - Number(b.number));
}

export function parseNovelphoenixDetails(html = "", url = "", baseUrl = DEFAULT_BASE_URL) {
  const slug = slugFromNovelUrl(url);
  const title = textOnly(html.match(/<h1[^>]*class="[^"]*novel-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    || "");
  const cover = toAbsoluteUrl(
    parseImageUrl(html.match(/<figure class="novel-cover"[\s\S]*?<img[^>]*>/i)?.[0] || "")
      || html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1]
      || "",
    baseUrl,
  );
  const summary = textOnly(html.match(/<div class="summary"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
  const categories = [...html.matchAll(/<div class="categories"><h4>Genres<\/h4><ul>([\s\S]*?)<\/ul><\/div>/gi)]
    .flatMap((match) => [...match[1].matchAll(/title="([^"]+)"/gi)].map((entry) => textOnly(entry[1])))
    .filter(Boolean);
  const status = textOnly(html.match(/Status:\s*<strong[^>]*class="status"[^>]*>([\s\S]*?)<\/strong>/i)?.[1] || "");
  return {
    id: slug,
    title,
    cover,
    summary,
    url: buildNovelUrl(slug, baseUrl),
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    categories,
    tags: [],
    status,
    chapters: [],
  };
}

export function extractNovelphoenixContentHtml(html = "") {
  const startMatch = html.match(/<div id="content"[^>]*>/i);
  if (!startMatch) return "";
  const start = startMatch.index + startMatch[0].length;
  const endMarkers = [
    "</footer>",
    '<div id="toast-container"',
    'id="novel-report"',
    '<dialog class="control-action"',
  ];
  let end = html.length;
  for (const marker of endMarkers) {
    const index = html.indexOf(marker, start);
    if (index >= 0) end = Math.min(end, index);
  }
  return html.slice(start, end);
}

export function parseNovelphoenixChapter(html = "", url = "") {
  const title = textOnly(
    html.match(/<h1[^>]*>[\s\S]*?<\/h1>/i)?.[0]?.replace(/<[^>]+>/g, " ")
    || html.match(/<title>([^<]+)/i)?.[1]?.replace(/\s*-\s*Novel Phoenix.*$/i, "")
    || "Chapter",
  );
  const contentBlock = extractNovelphoenixContentHtml(html);
  const paragraphs = filterNovelParagraphs(
    [...contentBlock.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => textOnly(match[1]))
      .filter((entry) => entry.length > 1),
  );
  return {
    title,
    url,
    kind: "novel",
    contentLanguage: "en",
    paragraphs,
    pages: [],
  };
}

export async function handleNovelphoenixRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: SOURCE_NAME });
  const { baseUrl } = ctx;
  const fetchHtml = createFetcher(baseUrl);

  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(
      assertNovelphoenixImageUrl(requestUrl.searchParams.get("url") ?? "", ctx),
      `${baseUrl}/`,
      SOURCE_NAME,
    );
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const filters = await fetchFilters(fetchHtml, baseUrl);
    return responseJson(200, { ...filters, fetchedAt: new Date().toISOString() });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() || "";
    const tag = requestUrl.searchParams.get("tag")?.trim() || "";
    const kind = requestUrl.searchParams.get("kind")?.trim() || "";
    const targetUrl = buildNovelphoenixCatalogUrl({ page, genre, tag, kind, baseUrl });
    const html = await fetchHtml(targetUrl);
    const items = parseNovelphoenixCatalog(html, baseUrl);
    return responseJson(200, {
      items,
      page,
      genre,
      tag,
      kind,
      hasMore: catalogHasMorePages(html) || items.length >= 20,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [], page: 1, hasMore: false });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const html = await fetchHtml(buildNovelphoenixSearchUrl(query, page, baseUrl));
    const items = parseNovelphoenixCatalog(html, baseUrl);
    return responseJson(200, {
      items,
      page,
      hasMore: catalogHasMorePages(html) || items.length >= 20,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const rawUrl = requestUrl.searchParams.get("url") ?? "";
    const slug = slugFromNovelUrl(rawUrl);
    const html = await fetchHtml(buildNovelUrl(slug, baseUrl));
    const details = parseNovelphoenixDetails(html, rawUrl, baseUrl);
    details.chapters = await fetchAllChapters(slug, fetchHtml, baseUrl);
    return responseJson(200, details);
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = parseChapterTarget(requestUrl.searchParams.get("url") ?? "");
    const html = await fetchHtml(buildChapterUrl(target.slug, target.chapterNumber, baseUrl));
    const chapter = parseNovelphoenixChapter(html, buildChapterUrl(target.slug, target.chapterNumber, baseUrl));
    if (!chapter.paragraphs.length) throw new Error("تعذر استخراج فصل Novel Phoenix");
    return responseJson(200, chapter);
  }

  return responseJson(404, { error: "Route Novel Phoenix inconnue" });
}
