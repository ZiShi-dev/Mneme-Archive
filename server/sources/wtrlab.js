import { createDecipheriv } from "node:crypto";
import { textOnly } from "../lib/htmlUtils.js";
import { fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, recentChaptersFromCount } from "../lib/catalogChapters.js";
import { filterNovelParagraphs } from "../lib/novelChapterText.js";

const BASE_URL = "https://wtr-lab.com";
const SOURCE_NAME = "WTR-LAB";
const SOURCE_ID = "wtrlab";
const ALLOWED_HOSTS = new Set(["wtr-lab.com", "www.wtr-lab.com", "img.wtr-lab.com"]);
const PAGE_SIZE = 10;
const READER_KEY = Buffer.from("IJAFUUxjM25hyzL2AZrn0wl7cESED6Ru");
const API_HEADERS = {
  accept: "application/json, text/html",
  "accept-language": "en,ar;q=0.8",
  referer: `${BASE_URL}/`,
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

export const WTR_GENRES = [
  { id: 1, slug: "1", name: "Action" },
  { id: 2, slug: "2", name: "Adventure" },
  { id: 3, slug: "3", name: "Comedy" },
  { id: 4, slug: "4", name: "Drama" },
  { id: 5, slug: "5", name: "Fantasy" },
  { id: 6, slug: "6", name: "Harem" },
  { id: 7, slug: "7", name: "Historical" },
  { id: 8, slug: "8", name: "Horror" },
  { id: 9, slug: "9", name: "Martial Arts" },
  { id: 10, slug: "10", name: "Mature" },
  { id: 11, slug: "11", name: "Mystery" },
  { id: 12, slug: "12", name: "Psychological" },
  { id: 13, slug: "13", name: "Romance" },
  { id: 14, slug: "14", name: "School Life" },
  { id: 15, slug: "15", name: "Sci-fi" },
  { id: 16, slug: "16", name: "Seinen" },
  { id: 17, slug: "17", name: "Shoujo" },
  { id: 18, slug: "18", name: "Shounen" },
  { id: 19, slug: "19", name: "Slice of Life" },
  { id: 20, slug: "20", name: "Supernatural" },
  { id: 21, slug: "21", name: "Tragedy" },
  { id: 22, slug: "22", name: "Wuxia" },
  { id: 23, slug: "23", name: "Xianxia" },
  { id: 24, slug: "24", name: "Xuanhuan" },
  { id: 25, slug: "25", name: "Yaoi" },
  { id: 26, slug: "26", name: "Yuri" },
];

const KIND_PRESETS = {
  all: { path: "/en/novel-list" },
  popular: { path: "/en/novel-finder", orderBy: "view", order: "desc", status: "all" },
  trending: { path: "/en/trending" },
  latest: { path: "/en/novel-finder", orderBy: "date", order: "desc" },
  ongoing: { path: "/en/novel-finder", status: "ongoing" },
  completed: { path: "/en/novel-finder", status: "completed" },
  ranking: { path: "/en/ranking/daily" },
};

let filtersCache = null;

async function fetchRemote(url, { method = "GET", body = null, headers = {}, timeoutMs = 35_000 } = {}) {
  const response = await fetch(url, {
    method,
    redirect: "follow",
    headers: { ...API_HEADERS, ...headers },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`${SOURCE_NAME} a répondu ${response.status}`);
  }
  return response;
}

export function extractNextData(html = "") {
  const match = String(html).match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match) throw new Error("تعذر قراءة بيانات WTR-LAB");
  return JSON.parse(match[1]);
}

export function parseWtrlabCatalogPayload(nextData = {}) {
  const pageProps = nextData?.props?.pageProps || {};
  return pageProps.series || pageProps.list || [];
}

export function buildWtrlabCatalogUrl({
  page = 1,
  genre = "",
  tag = "",
  kind = "",
  orderBy = "",
  order = "",
  status = "",
} = {}) {
  const preset = KIND_PRESETS[kind] || null;
  const params = new URLSearchParams({ page: String(page) });
  let path = preset?.path || "/en/novel-list";

  const resolvedOrderBy = orderBy || preset?.orderBy || "";
  const resolvedOrder = order || preset?.order || "";
  const resolvedStatus = status || preset?.status || "";

  if (genre || tag || resolvedOrderBy || resolvedStatus) {
    path = "/en/novel-finder";
  }

  if (genre) params.set("gi", genre);
  if (tag) params.set("ti", tag);
  if (resolvedOrderBy) params.set("orderBy", resolvedOrderBy);
  if (resolvedOrder) params.set("order", resolvedOrder);
  if (resolvedStatus && resolvedStatus !== "all") params.set("status", resolvedStatus);

  return `${BASE_URL}${path}?${params}`;
}

export function buildWtrlabNovelUrl(rawId, slug) {
  return `${BASE_URL}/en/novel/${rawId}/${slug}`;
}

export function buildWtrlabChapterUrl(rawId, slug, chapterNo) {
  return `${BASE_URL}/en/novel/${rawId}/${slug}/${chapterNo}`;
}

export function parseWtrlabTarget(rawUrl = "") {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || (host !== "wtr-lab.com" && host !== "www.wtr-lab.com")) {
    throw new Error("المصدر غير مسموح");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const novelIndex = parts.indexOf("novel");
  if (novelIndex >= 0 && parts[novelIndex + 1]) {
    const rawId = parts[novelIndex + 1];
    const slug = parts[novelIndex + 2] || "";
    const chapterNo = parts[novelIndex + 3] ? Number(parts[novelIndex + 3]) : null;
    if (!/^\d+$/.test(rawId) || !slug) throw new Error("رابط WTR-LAB غير صالح");
    return { rawId, slug, chapterNo: Number.isFinite(chapterNo) ? chapterNo : null };
  }
  const legacy = url.pathname.match(/serie-(\d+)\/([^/]+)(?:\/chapter-(\d+))?/i);
  if (legacy) {
    return {
      rawId: legacy[1],
      slug: legacy[2],
      chapterNo: legacy[3] ? Number(legacy[3]) : null,
    };
  }
  throw new Error("رابط WTR-LAB غير صالح");
}

function assertWtrlabImageUrl(rawUrl = "") {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith("wtr-lab.com")) {
    throw new Error("رابط الصورة غير مسموح");
  }
  return url.toString();
}

export function decryptWtrlabChapterBody(encrypted) {
  if (Array.isArray(encrypted)) return encrypted;
  if (typeof encrypted !== "string" || !encrypted) {
    throw new Error("تعذر فك محتوى الفصل");
  }
  let payload = encrypted;
  let asArray = false;
  if (payload.startsWith("arr:")) {
    asArray = true;
    payload = payload.slice(4);
  } else if (payload.startsWith("str:")) {
    payload = payload.slice(4);
  } else {
    return [payload];
  }
  const [ivPart, tagPart, cipherPart] = payload.split(":");
  if (!ivPart || !tagPart || !cipherPart) throw new Error("تعذر فك محتوى الفصل");
  const iv = Buffer.from(ivPart, "base64");
  const tag = Buffer.from(tagPart, "base64");
  const cipher = Buffer.from(cipherPart, "base64");
  const combined = Buffer.concat([cipher, tag]);
  const decipher = createDecipheriv("aes-256-gcm", READER_KEY, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(cipher), decipher.final()]).toString("utf8");
  return asArray ? JSON.parse(plain) : [plain];
}

export function parseWtrlabChapterParagraphs(body, glossaryTerms = []) {
  const lines = decryptWtrlabChapterBody(body);
  const paragraphs = [];
  for (const line of lines) {
    if (line === "[image]") continue;
    let text = textOnly(String(line).replace(/<[^>]+>/g, " "));
    for (let index = 0; index < glossaryTerms.length; index += 1) {
      const term = glossaryTerms[index]?.[0];
      if (!term) continue;
      text = text.replaceAll(`※${index}⛬`, term).replaceAll(`※${index}〓`, term);
    }
    if (text) paragraphs.push(text);
  }
  return filterNovelParagraphs(paragraphs);
}

export function isPredominantlyCjk(text = "") {
  const chars = String(text).replace(/\s/g, "");
  if (!chars.length) return false;
  const cjk = (chars.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g) || []).length;
  return cjk / chars.length > 0.2;
}

function mapCatalogItem(entry = {}) {
  const data = entry.data || {};
  const rawId = String(entry.raw_id || "");
  const slug = entry.slug || "";
  const url = rawId && slug ? buildWtrlabNovelUrl(rawId, slug) : "";
  const chapterCount = Number(entry.chapter_count || entry.raw_chapter_count || 0) || 0;
  const recentChapters = recentChaptersFromCount(chapterCount, (number) => (
    rawId && slug ? buildWtrlabChapterUrl(rawId, slug, number) : null
  ));
  return applyRecentChapterFields({
    id: slug || rawId,
    title: data.title || entry.search_text || "",
    altTitle: data.raw?.title || "",
    url,
    cover: data.image || "",
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    author: data.author || entry.author || "",
    categories: (entry.genres || []).map((id) => WTR_GENRES.find((genre) => genre.id === id)?.name).filter(Boolean),
    tags: [],
    chapterCount,
    status: entry.status === 1 ? "completed" : "ongoing",
    publishedAt: entry.release_at || entry.created_at || entry.updated_at || "",
  }, recentChapters);
}

async function fetchCatalogPage(targetUrl) {
  const response = await fetchRemote(targetUrl);
  const html = await response.text();
  const nextData = extractNextData(html);
  const items = parseWtrlabCatalogPayload(nextData).map(mapCatalogItem);
  const total = Number(nextData?.props?.pageProps?.count || 0);
  const page = Number(nextData?.query?.page || 1);
  const hasMore = total ? page * PAGE_SIZE < total : items.length >= PAGE_SIZE;
  return { items, hasMore, total, page };
}

async function fetchTagFilters() {
  if (filtersCache && Date.now() - filtersCache.at < 30 * 60_000) {
    return filtersCache.data;
  }
  const response = await fetchRemote(`${BASE_URL}/en/tags`);
  const html = await response.text();
  const nextData = extractNextData(html);
  const tags = (nextData?.props?.pageProps?.tags || [])
    .map((entry) => ({
      slug: String(entry.id || entry.slug || ""),
      name: entry.title || entry.slug || "",
      count: Number(entry.count) || 0,
    }))
    .filter((entry) => entry.slug && entry.name);
  const categories = WTR_GENRES.map((genre) => ({
    slug: genre.slug,
    name: genre.name,
    count: 0,
  }));
  const data = { categories, tags };
  filtersCache = { at: Date.now(), data };
  return data;
}

async function fetchNovelDetails(rawUrl) {
  const response = await fetchRemote(rawUrl);
  const html = await response.text();
  const nextData = extractNextData(html);
  const serieRoot = nextData?.props?.pageProps?.serie || {};
  const serieData = serieRoot.serie_data || serieRoot;
  const data = serieData.data || {};
  const rawId = String(serieData.raw_id || parseWtrlabTarget(rawUrl).rawId);
  const slug = serieData.slug || parseWtrlabTarget(rawUrl).slug;
  const tags = (nextData?.props?.pageProps?.tags || [])
    .map((tag) => tag.title)
    .filter(Boolean);
  const chapterCount = Number(serieData.chapter_count || serieData.raw_chapter_count || 0) || 0;
  const chaptersResponse = await fetchRemote(`${BASE_URL}/api/chapters/${rawId}?start=1&end=${Math.max(chapterCount, 1)}`);
  const chaptersPayload = await chaptersResponse.json();
  const chapters = (chaptersPayload?.chapters || [])
    .map((chapter) => ({
      url: buildWtrlabChapterUrl(rawId, slug, chapter.order),
      name: chapter.title || chapter.name || String(chapter.order),
      number: String(chapter.order),
      date: chapter.updated_at || "",
      chapterId: chapter.id,
    }))
    .sort((a, b) => Number(b.number) - Number(a.number));

  return {
    id: slug,
    title: data.title || "",
    altTitle: data.raw?.title || "",
    cover: data.image || "",
    summary: data.description || data.raw?.description || "",
    url: buildWtrlabNovelUrl(rawId, slug),
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    author: data.author || data.raw?.author || "",
    categories: (serieData.genres || []).map((id) => WTR_GENRES.find((genre) => genre.id === id)?.name).filter(Boolean),
    tags,
    chapters,
    rawId,
    slug,
  };
}

async function requestChapterPayload(rawId, chapterNo, translate = "ai", slug = "") {
  const referer = slug
    ? `${BASE_URL}/en/novel/${rawId}/${slug}/${chapterNo}`
    : `${BASE_URL}/en/novel/${rawId}/`;
  const response = await fetchRemote(`${BASE_URL}/api/reader/get`, {
    method: "POST",
    body: JSON.stringify({
      translate,
      language: "en",
      raw_id: Number(rawId),
      chapter_no: chapterNo,
      retry: false,
      force_retry: false,
    }),
    headers: {
      "content-type": "application/json",
      referer,
    },
  });
  const payload = await response.json();
  if (!payload?.success) {
    throw new Error(payload?.error || payload?.message || "تعذر تحميل الفصل");
  }
  return payload;
}

async function fetchChapterContent(target, { forceRaw = false } = {}) {
  const { rawId, slug, chapterNo } = target;
  let payload = null;
  let contentLanguage = "en";
  let lastError = null;

  if (!forceRaw) {
    try {
      payload = await requestChapterPayload(rawId, chapterNo, "ai", slug);
    } catch (error) {
      lastError = error;
    }
  }

  if (!payload) {
    try {
      payload = await requestChapterPayload(rawId, chapterNo, "web", slug);
      contentLanguage = "zh";
    } catch (fallbackError) {
      const message = String(fallbackError?.message || lastError?.message || "");
      if (/turnstile|logged in/i.test(message)) {
        throw new Error("حماية WTR-LAB تتطلب تسجيل الدخول أو إعادة المحاولة لاحقًا");
      }
      throw fallbackError;
    }
  }

  const glossaryTerms = payload?.data?.data?.glossary_data?.terms || [];
  const paragraphs = parseWtrlabChapterParagraphs(payload?.data?.data?.body, glossaryTerms);
  return {
    title: payload?.chapter?.title || `Chapter ${chapterNo}`,
    url: buildWtrlabChapterUrl(rawId, slug, chapterNo),
    kind: "novel",
    contentLanguage,
    paragraphs,
    pages: [],
  };
}

export async function handleWtrlabRequest(requestUrl) {
  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(assertWtrlabImageUrl(requestUrl.searchParams.get("url") ?? ""), `${BASE_URL}/`, SOURCE_NAME);
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const filters = await fetchTagFilters();
    return responseJson(200, { ...filters, fetchedAt: new Date().toISOString() });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 500);
    const genre = requestUrl.searchParams.get("genre")?.trim() || "";
    const tag = requestUrl.searchParams.get("tag")?.trim() || "";
    const kind = requestUrl.searchParams.get("kind")?.trim() || "";
    const targetUrl = buildWtrlabCatalogUrl({ page, genre, tag, kind });
    const { items, hasMore } = await fetchCatalogPage(targetUrl);
    return responseJson(200, {
      items,
      page,
      genre,
      tag,
      kind,
      hasMore,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 100);
    if (!valid) return responseJson(200, { items: [], page, hasMore: false });
    const genre = requestUrl.searchParams.get("genre")?.trim() || "";
    const tag = requestUrl.searchParams.get("tag")?.trim() || "";
    const kind = requestUrl.searchParams.get("kind")?.trim() || "";
    const params = new URLSearchParams({ text: query, page: String(page) });
    if (genre) params.set("gi", genre);
    if (tag) params.set("ti", tag);
    if (kind && KIND_PRESETS[kind]?.orderBy) params.set("orderBy", KIND_PRESETS[kind].orderBy);
    if (kind && KIND_PRESETS[kind]?.status) params.set("status", KIND_PRESETS[kind].status);
    const response = await fetchRemote(`${BASE_URL}/en/novel-finder?${params.toString()}`);
    const html = await response.text();
    const nextData = extractNextData(html);
    const items = parseWtrlabCatalogPayload(nextData).map(mapCatalogItem);
    const total = Number(nextData?.props?.pageProps?.count || items.length);
    return responseJson(200, {
      items,
      page,
      hasMore: page * PAGE_SIZE < total,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const rawUrl = requestUrl.searchParams.get("url") ?? "";
    const details = await fetchNovelDetails(rawUrl);
    return responseJson(200, details);
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = parseWtrlabTarget(requestUrl.searchParams.get("url") ?? "");
    if (!target.chapterNo) throw new Error("رابط فصل WTR-LAB غير صالح");
    const forceRaw = requestUrl.searchParams.get("raw") === "1";
    const chapter = await fetchChapterContent(target, { forceRaw });
    return responseJson(200, chapter);
  }

  return responseJson(404, { error: "Route WTR-LAB inconnue" });
}
