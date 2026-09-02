import { fetchWithRetries } from "./httpUtils.js";

const API_BASE = process.env.SKYNOVEL_API_BASE || "http://62.171.141.197:5007";
/** L’app officielle envoie `10` (pas `10.0.0`). Les versions < 10 renvoient HTTP 426 forceUpdate. */
const APP_VERSION = process.env.SKYNOVEL_APP_VERSION || "10";
const AUTH_TOKEN = String(process.env.SKYNOVEL_AUTH_TOKEN || "").trim();
const CHAPTERS_PAGE_SIZE = 100;
const CHAPTERS_MAX_PAGES = 50;
const CHAPTER_LIST_BATCH = 4;
const REQUEST_TIMEOUT_MS = 35_000;
const CHAPTER_CACHE_TTL_MS = 15 * 60_000;
const CHAPTER_LIST_CACHE_TTL_MS = 10 * 60_000;
const SKY_CACHE_MAX = 64;

const BR_RE = /<br\s*\/?>/gi;
const P_CLOSE_RE = /<\/p>/gi;
const TAG_RE = /<[^>]+>/g;

const skyCache = new Map();
const skyInflight = new Map();

function buildSkyHeaders() {
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
    "user-agent": "Dart/3.9 (dart:io)",
    "x-app-version": APP_VERSION,
    "accept-encoding": "gzip",
  };
  if (AUTH_TOKEN) {
    headers.authorization = AUTH_TOKEN.startsWith("Bearer ") ? AUTH_TOKEN : `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

function touchSkyCache(key, data) {
  if (skyCache.has(key)) skyCache.delete(key);
  skyCache.set(key, { at: Date.now(), data });
  while (skyCache.size > SKY_CACHE_MAX) {
    const oldest = skyCache.keys().next().value;
    if (oldest == null) break;
    skyCache.delete(oldest);
  }
}

function readSkyCache(key, ttlMs) {
  const entry = skyCache.get(key);
  if (!entry || Date.now() - entry.at >= ttlMs) return null;
  touchSkyCache(key, entry.data);
  return entry.data;
}

export function clearSkyApiCache() {
  skyCache.clear();
  skyInflight.clear();
}

function resolveSkyApiUrl(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    throw new Error("مسار Sky Novel API غير صالح");
  }
  return `${API_BASE.replace(/\/+$/, "")}${path}`;
}

async function parseSkyResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (data?.forceUpdate) {
    throw new Error(`تعذر تحميل الفصل: ${data.message || "يتطلب التطبيق تحديثاً من المتجر"}`);
  }
  if (!response.ok || data.success === false) {
    throw new Error(skyFailureMessage(data, response.status));
  }
  return data;
}

async function requestSkyJson(path, { method = "GET", body, cacheTtl = 0 } = {}) {
  const cacheable = method === "GET" && !body && cacheTtl > 0;
  const cacheKey = `${method}:${path}`;

  if (cacheable) {
    const hit = readSkyCache(cacheKey, cacheTtl);
    if (hit) return hit;
    const pending = skyInflight.get(cacheKey);
    if (pending) return pending;
  }

  const url = resolveSkyApiUrl(path);
  const work = (async () => {
    const response = await fetchWithRetries(url, {
      method,
      headers: buildSkyHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      timeoutMs: REQUEST_TIMEOUT_MS,
    }, 1);
    return parseSkyResponse(response);
  })();

  if (cacheable) skyInflight.set(cacheKey, work);
  try {
    const data = await work;
    if (cacheable) touchSkyCache(cacheKey, data);
    return data;
  } finally {
    if (cacheable) skyInflight.delete(cacheKey);
  }
}

export async function fetchSkyJson(path, options = {}) {
  return requestSkyJson(path, options);
}

export function isSkyUnauthorized(data = {}, status = 0) {
  const message = String(data?.message || data?.error || "");
  return Number(status) === 403 || message.includes("غير مصرح");
}

export const SKY_APP_ONLY_CHAPTER_MESSAGE = "تعذر تحميل الفصل: خادم Sky Novel رفض الجلسة.";

function skyFailureMessage(data, status) {
  if (isSkyUnauthorized(data, status)) return SKY_APP_ONLY_CHAPTER_MESSAGE;
  const message = data?.message || data?.error;
  if (message) return String(message).startsWith("تعذر") ? message : `تعذر تحميل الفصل عبر Sky Novel: ${message}`;
  return `تعذر تحميل الفصل عبر Sky Novel: ${status}`;
}

function chapterParagraphs(raw = "") {
  if (Array.isArray(raw)) {
    return raw.map((p) => String(p).trim()).filter((p) => p.length > 1);
  }
  const text = String(raw).replace(BR_RE, "\n").replace(P_CLOSE_RE, "\n");
  const stripped = text.replace(TAG_RE, "");
  return stripped
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 1);
}

export function parseSkyChapterPayload(data, url) {
  const block = data?.data?.chapter ?? data?.data ?? data?.chapter ?? data;
  const title = block?.title ?? block?.name ?? block?.chapterTitle ?? "فصل";
  const content =
    block?.content ?? block?.text ?? block?.body ?? block?.chapterContent ?? block?.htmlContent ?? "";
  const paragraphs = chapterParagraphs(content);
  if (!paragraphs.length) throw new Error("تعذر استخراج محتوى الفصل من Sky Novel API");
  return {
    title: String(title),
    url,
    kind: "novel",
    paragraphs,
    pages: [],
  };
}

function normalizeSkyChapterList(data) {
  const list = data?.data?.chapters ?? data?.data ?? data?.chapters ?? [];
  return Array.isArray(list) ? list : [];
}

function mergeSkyChapterEntries(target, seen, list) {
  for (const entry of list) {
    const key = String(entry?._id || entry?.id || entry?.chapterNumber || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    target.push(entry);
  }
  return list.length;
}

async function fetchSkyChapterListPage(encodedNovelId, page) {
  return requestSkyJson(`/novels/${encodedNovelId}/chapters?page=${page}`, {
    cacheTtl: CHAPTER_LIST_CACHE_TTL_MS,
  });
}

export async function fetchSkyNovelChapters(novelId) {
  const listCacheKey = `list:${novelId}`;
  const cachedList = readSkyCache(listCacheKey, CHAPTER_LIST_CACHE_TTL_MS);
  if (cachedList) return cachedList;

  const pendingList = skyInflight.get(listCacheKey);
  if (pendingList) return pendingList;

  const encoded = encodeURIComponent(novelId);
  const work = (async () => {
    const all = [];
    const seen = new Set();

    const first = await fetchSkyChapterListPage(encoded, 1);
    const firstList = normalizeSkyChapterList(first);
    mergeSkyChapterEntries(all, seen, firstList);
    if (!firstList.length || firstList.length < CHAPTERS_PAGE_SIZE) return all;

    let page = 2;
    while (page <= CHAPTERS_MAX_PAGES) {
      const pages = [];
      for (let offset = 0; offset < CHAPTER_LIST_BATCH && page + offset <= CHAPTERS_MAX_PAGES; offset += 1) {
        pages.push(page + offset);
      }
      const batch = await Promise.all(pages.map((p) => fetchSkyChapterListPage(encoded, p)));
      let stop = false;
      for (const data of batch) {
        const count = mergeSkyChapterEntries(all, seen, normalizeSkyChapterList(data));
        if (!count || count < CHAPTERS_PAGE_SIZE) {
          stop = true;
          break;
        }
      }
      if (stop) break;
      page += pages.length;
    }

    return all;
  })();

  skyInflight.set(listCacheKey, work);
  try {
    const list = await work;
    touchSkyCache(listCacheKey, list);
    return list;
  } finally {
    skyInflight.delete(listCacheKey);
  }
}

export async function fetchSkyChapter(novelId, chapterNumber, chapterUrl) {
  const data = await requestSkyJson(
    `/novels/${encodeURIComponent(novelId)}/chapters/${Number(chapterNumber)}`,
    { cacheTtl: CHAPTER_CACHE_TTL_MS },
  );
  return parseSkyChapterPayload(data, chapterUrl);
}
