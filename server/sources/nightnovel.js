import { textOnly } from "../lib/htmlUtils.js";
import { fetchProxiedImage } from "../lib/httpUtils.js";
import { splitNightNovelParagraphs } from "../lib/nightNovelText.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, recentChaptersFromCount } from "../lib/catalogChapters.js";

const BASE_URL = "https://nightnovelapp.tech";
const API_URL = `${BASE_URL}/api`;
const SOURCE_NAME = "Night Novel";
const SOURCE_ID = "nightnovel";
const LANG = "ar";
const CATALOG_PAGE_SIZE = 24;
const CATALOG_CACHE_TTL_MS = 3 * 60_000;
let catalogCache = null;

const API_HEADERS = {
  accept: "application/json",
  "accept-language": "ar,en;q=0.8",
  "user-agent": "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36 Chrome/124 Safari/537.36",
};

async function fetchJson(path, { headers = {}, method = "GET" } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    redirect: "follow",
    headers: { ...API_HEADERS, ...headers },
    signal: AbortSignal.timeout(35_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const message = data.message || data.error || `Night Novel a répondu ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function assertNightNovelHost(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !["nightnovelapp.tech", "www.nightnovelapp.tech"].includes(url.hostname)) {
    throw new Error("المصدر غير مسموح");
  }
  url.hostname = "nightnovelapp.tech";
  url.hash = "";
  return url;
}

function assertNightNovelImageUrl(rawUrl) {
  const url = assertNightNovelHost(rawUrl);
  if (!url.pathname.startsWith("/api/uploads/")) throw new Error("رابط الصورة غير مسموح");
  return url.toString();
}

function buildNovelUrl(slug) {
  return `${BASE_URL}/novel/${slug}?lang=${LANG}`;
}

function buildChapterUrl(novelId, chapterNumber) {
  return `${BASE_URL}/read/${novelId}/chapter/${chapterNumber}?lang=${LANG}`;
}

export function slugFromNovelUrl(rawUrl) {
  const url = assertNightNovelHost(rawUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "novel" && parts[1]) return parts[1];
  if (parts[0] === "novels" && parts[1]) return parts[1];
  throw new Error("رابط Night Novel غير صالح");
}

export function parseChapterTarget(rawUrl) {
  const url = assertNightNovelHost(rawUrl);
  const readMatch = url.pathname.match(/^\/read\/(\d+)\/chapter\/(\d+)$/i);
  if (readMatch) {
    return { novelId: Number(readMatch[1]), chapterNumber: Number(readMatch[2]), slug: null };
  }
  const apiMatch = url.pathname.match(/^\/novels\/([^/]+)\/chapters\/(\d+)$/i);
  if (apiMatch) {
    return { novelId: null, chapterNumber: Number(apiMatch[2]), slug: apiMatch[1] };
  }
  throw new Error("رابط فصل Night Novel غير صالح");
}

function mapCategories(raw = []) {
  return raw
    .map((entry) => entry?.name || entry?.slug || "")
    .filter(Boolean)
    .slice(0, 30);
}

function mapTags(raw = []) {
  return raw
    .map((entry) => entry?.name || entry?.slug || "")
    .filter(Boolean)
    .slice(0, 40);
}

function latestChapterFromList(chapters = []) {
  if (!chapters.length) return { latestChapter: "—", latestChapterUrl: null, recentChapters: [] };
  const sorted = [...chapters].sort((a, b) => Number(b.number || 0) - Number(a.number || 0));
  const latest = sorted[0];
  const novelId = latest.novelId;
  const url = novelId ? buildChapterUrl(novelId, latest.number) : null;
  return {
    latestChapter: String(latest.number || "—"),
    latestChapterUrl: url,
    recentChapters: sorted.slice(0, 2).map((chapter) => ({
      number: String(chapter.number || ""),
      name: chapter.title || String(chapter.number || ""),
      url: novelId ? buildChapterUrl(novelId, chapter.number) : null,
    })),
  };
}

function mapCatalogItem(novel) {
  const slug = novel.slug || String(novel.id || "");
  const totalChapters = Number(novel.totalChapters ?? novel.chapters ?? 0) || 0;
  const novelId = Number(novel.id) || null;
  const recentChapters = recentChaptersFromCount(totalChapters, (number) => (
    novelId ? buildChapterUrl(novelId, number) : null
  ));
  return applyRecentChapterFields({
    id: slug,
    title: novel.title || "",
    altTitle: novel.altTitle || "",
    url: buildNovelUrl(slug),
    cover: novel.coverPath || novel.image || "",
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    categories: mapCategories(novel.categories),
    tags: mapTags(novel.tags),
  }, recentChapters);
}

function mapChapterEntry(chapter, novelId, slug) {
  const number = Number(chapter.number);
  return {
    url: buildChapterUrl(novelId, number),
    name: chapter.title || String(number),
    number: String(number),
    date: chapter.publishedAt || chapter.published_at || "",
    locked: Boolean(chapter.requiresLogin),
    slug: chapter.slug || "",
    novelSlug: slug,
  };
}

function parseChapterParagraphs(chapter = {}) {
  const html = chapter.contentHtml || chapter.content_html || "";
  if (html && /<[a-z][\s\S]*>/i.test(html)) {
    return [...String(html).matchAll(/<(?:p|h[2-6]|blockquote|div)[^>]*>([\s\S]*?)<\/(?:p|h[2-6]|blockquote|div)>/gi)]
      .map((match) => textOnly(match[1]))
      .filter((text) => text && text.length > 1);
  }
  const plain = chapter.content || "";
  if (plain) return splitNightNovelParagraphs(plain);
  return [];
}

async function fetchChapterAccessToken(slug, chapterNumber) {
  const data = await fetchJson(`/novels/${encodeURIComponent(slug)}/chapters/${chapterNumber}/read-access?lang=${LANG}`);
  const token = data?.data?.accessToken;
  if (!token || typeof token !== "string") throw new Error("تعذر الحصول على حق القراءة");
  return token;
}

async function fetchChapterPayload(slug, chapterNumber) {
  const accessToken = await fetchChapterAccessToken(slug, chapterNumber);
  const data = await fetchJson(
    `/novels/${encodeURIComponent(slug)}/chapters/${chapterNumber}?lang=${LANG}`,
    { headers: { "X-Chapter-Read-Access": accessToken } },
  );
  return data?.data?.chapter || data?.chapter || data?.data || data;
}

async function resolveChapterSlug(target) {
  if (target.slug) return target.slug;
  const data = await fetchJson(`/novels/${target.novelId}/details?lang=${LANG}`);
  const slug = data?.data?.novel?.slug || data?.novel?.slug;
  if (!slug) throw new Error("رواية Night Novel غير موجودة");
  return slug;
}

export async function parseNightNovelDetails(slug) {
  const data = await fetchJson(`/novels/${encodeURIComponent(slug)}/details?lang=${LANG}`);
  const novel = data?.data?.novel || data?.novel || {};
  const chapters = data?.data?.chapters || data?.chapters || [];
  const novelId = Number(novel.id);
  const mappedChapters = chapters
    .map((chapter) => mapChapterEntry(chapter, novelId, slug))
    .filter((chapter) => chapter.number)
    .sort((a, b) => Number(b.number) - Number(a.number));

  return {
    id: slug,
    title: novel.title || "",
    altTitle: novel.altTitle || "",
    cover: novel.image || novel.coverPath || "",
    summary: novel.description || "",
    url: buildNovelUrl(slug),
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    categories: mapCategories(novel.categories),
    tags: mapTags(novel.tags),
    chapters: mappedChapters.reverse(),
  };
}

export function parseNightNovelChapter(chapter, url) {
  const paragraphs = parseChapterParagraphs(chapter);
  return {
    title: chapter.title || chapter.displayTitle || "فصل",
    url,
    kind: "novel",
    paragraphs,
    pages: [],
  };
}

async function fetchRecentCatalogPage(page, limit = CATALOG_PAGE_SIZE) {
  const data = await fetchJson(`/novels/recent?lang=${LANG}&limit=${limit}&page=${page}`);
  const novels = data.novels || data?.data?.novels || [];
  const items = [];
  const seen = new Set();
  for (const novel of novels) {
    const slug = novel.slug || String(novel.id || "");
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    items.push(mapCatalogItem(novel));
  }
  return {
    items,
    hasMore: novels.length >= limit,
  };
}

async function fetchAllCatalogNovels() {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_CACHE_TTL_MS) {
    return catalogCache.items;
  }
  const seen = new Set();
  const items = [];
  for (let page = 1; page <= 8; page += 1) {
    try {
      const data = await fetchJson(`/novels/recent?lang=${LANG}&limit=50&page=${page}`);
      const novels = data.novels || data?.data?.novels || [];
      if (!novels.length) break;
      for (const novel of novels) {
        const slug = novel.slug || String(novel.id || "");
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        items.push(mapCatalogItem(novel));
      }
      if (novels.length < 50) break;
    } catch {
      if (page === 1) throw new Error("تعذر تحميل روايات Night Novel الحديثة");
      break;
    }
  }
  catalogCache = { at: Date.now(), items };
  return items;
}

export async function handleNightNovelRequest(requestUrl) {
  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(assertNightNovelImageUrl(requestUrl.searchParams.get("url") ?? ""), `${BASE_URL}/`, SOURCE_NAME);
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const [categoriesData, tagsData] = await Promise.all([
      fetchJson(`/library/categories?lang=${LANG}`),
      fetchJson(`/library/tags?lang=${LANG}`),
    ]);
    const categories = (categoriesData.data || []).map((entry) => ({
      slug: entry.slug || String(entry.id || ""),
      name: entry.name || entry.slug || "",
      count: Number(entry.usageCount) || 0,
    }));
    const tags = (tagsData.data || []).map((entry) => ({
      slug: entry.slug || String(entry.id || ""),
      name: entry.name || entry.slug || "",
      count: Number(entry.usageCount) || 0,
    }));
    return responseJson(200, { categories, tags, fetchedAt: new Date().toISOString() });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() || "";
    const tag = requestUrl.searchParams.get("tag")?.trim() || "";

    if (!genre && !tag) {
      const { items, hasMore } = await fetchRecentCatalogPage(page);
      return responseJson(200, {
        items,
        page,
        genre,
        tag,
        hasMore,
        fetchedAt: new Date().toISOString(),
      });
    }

    let items = await fetchAllCatalogNovels();

    if (genre) {
      const needle = genre.toLocaleLowerCase("ar");
      items = items.filter((item) => item.categories?.some((name) => name.toLocaleLowerCase("ar").includes(needle)));
    }
    if (tag) {
      const needle = tag.toLocaleLowerCase("ar");
      items = items.filter((item) => item.tags?.some((name) => name.toLocaleLowerCase("ar").includes(needle)));
    }

    const offset = (page - 1) * CATALOG_PAGE_SIZE;
    const slice = items.slice(offset, offset + CATALOG_PAGE_SIZE);
    return responseJson(200, {
      items: slice,
      page,
      genre,
      tag,
      hasMore: offset + CATALOG_PAGE_SIZE < items.length,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const needle = query.toLocaleLowerCase("ar");
    const items = await fetchAllCatalogNovels();
    const filtered = items.filter((item) => {
      const haystack = `${item.title} ${item.altTitle}`.toLocaleLowerCase("ar");
      return haystack.includes(needle);
    });
    return responseJson(200, { items: filtered, page: 1, hasMore: false });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const slug = slugFromNovelUrl(requestUrl.searchParams.get("url") ?? "");
    const details = await parseNightNovelDetails(slug);
    return responseJson(200, details);
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = parseChapterTarget(requestUrl.searchParams.get("url") ?? "");
    const slug = await resolveChapterSlug(target);
    const chapter = await fetchChapterPayload(slug, target.chapterNumber);
    const url = buildChapterUrl(Number(chapter.novelId || target.novelId), target.chapterNumber);
    return responseJson(200, parseNightNovelChapter(chapter, url));
  }

  return responseJson(404, { error: "Route Night Novel inconnue" });
}
