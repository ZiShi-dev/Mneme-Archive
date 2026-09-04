import { resolveCachedImage } from "../../lib/storage/imageCache";
import { isAllowedImageUrl } from "../../lib/storage/security";
import { normalizeRemoteImageUrl } from "./coverDisplay";
import { assertLiveSourcesAvailable } from "../../lib/platform/liveSources";
import { toUserFacingError } from "../../lib/errors/userFacingError";
import { t } from "../../i18n/runtime.js";
import { MAX_SEARCH_QUERY_LENGTH } from "../../../server/lib/queryLimits.js";
import { Capacitor } from "@capacitor/core";
import { getRuntimeSettings } from "../../lib/settings/runtimeSettings.js";
import { allowsSpeculativePrefetch } from "../../lib/platform/dataSaver.js";
import { getDefaultSourceBaseUrl, getEffectiveSourceBaseUrl } from "../../lib/settings/sourceBaseUrls.js";
import { FLARE_DIRECT_SOURCE_ID_SET, WEBVIEW_SOURCE_ID_SET } from "../../lib/platform/webViewSources.js";
import { getKindQueryParam, sourcesWithCapability } from "../../config/sourceCapabilities.js";
import { buildSourceEmbedUrl } from "../../lib/video/sourceEmbedProxy.js";

const FILTER_PATH_SOURCES = new Set(sourcesWithCapability("filterPath"));
const GENRE_FILTER_SOURCES = sourcesWithCapability("genreFilter");
const TAG_FILTER_SOURCES = sourcesWithCapability("tagFilter");
const CLOUDFLARE_NATIVE_SOURCE_IDS = new Set([
  ...WEBVIEW_SOURCE_ID_SET,
  ...FLARE_DIRECT_SOURCE_ID_SET,
]);

function appendSourceQueryParams(query, sourceId) {
  const settings = getRuntimeSettings();
  const effective = getEffectiveSourceBaseUrl(sourceId, settings.sourceBaseUrls);
  const defaultUrl = getDefaultSourceBaseUrl(sourceId);
  if (effective && defaultUrl && effective !== defaultUrl) {
    query.set("baseUrl", effective);
  }
}

const sourcePath = (sourceId, resource) => `/api/sources/${sourceId}/${resource}`;
const isNative = () => Capacitor.isNativePlatform();

function pathUsesCloudflareNative(path = "") {
  for (const sourceId of CLOUDFLARE_NATIVE_SOURCE_IDS) {
    if (path.includes(`/api/sources/${sourceId}/`)) return true;
  }
  return false;
}

function appendKindFilter(query, sourceId, queryParam, queryValue) {
  const kindParam = getKindQueryParam(sourceId);
  if (kindParam && queryParam === "type" && queryValue) {
    query.set(kindParam, queryValue);
  }
}

function appendCatalogQueryFilters(query, sourceId, {
  genre = "",
  tag = "",
  tagPath = "",
  filterPath = "",
  queryParam = "",
  queryValue = "",
} = {}) {
  if (GENRE_FILTER_SOURCES.includes(sourceId) && genre) query.set("genre", genre);
  if (TAG_FILTER_SOURCES.includes(sourceId) && tag) {
    query.set("tag", tag);
    if (tagPath) query.set("tagPath", tagPath);
  }
  if (FILTER_PATH_SOURCES.has(sourceId) && filterPath) {
    query.set("filterPath", filterPath);
    if (queryParam && queryValue) {
      query.set("queryParam", queryParam);
      query.set("queryValue", queryValue);
    }
  }
  appendKindFilter(query, sourceId, queryParam, queryValue);
}

let cloudflareNativeReady = false;

const NATIVE_REQUEST_TIMEOUT_MS = 180_000;

async function withTimeout(promise, fallbackMessage, timeoutMs = NATIVE_REQUEST_TIMEOUT_MS) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(t("errors.requestTimeout"))), timeoutMs);
      }),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error(fallbackMessage);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function ensureCloudflareNative() {
  if (!isNative() || cloudflareNativeReady) return;
  const { initCloudflareNative } = await import("../../lib/platform/mangalikNative.js");
  await initCloudflareNative();
  cloudflareNativeReady = true;
}

async function readJson(response, fallbackMessage) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || fallbackMessage);
  return data;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

async function requestJson(path, fallbackMessage, { ttlMs = 0, signal, staleMs = 0 } = {}) {
  assertLiveSourcesAvailable();
  throwIfAborted(signal);
  if (ttlMs > 0) {
    const cached = readJsonCache(path, ttlMs, { staleMs });
    if (cached && !isJsonCacheStale(path, ttlMs, staleMs)) return cached;
    const inflight = jsonInFlight.get(path);
    if (inflight) return inflight;
    if (cached && isJsonCacheStale(path, ttlMs, staleMs)) {
      void refreshJsonCache(path, fallbackMessage);
      return cached;
    }
  }

  const pending = (async () => {
    throwIfAborted(signal);
    const data = isNative()
      ? await withTimeout((async () => {
        throwIfAborted(signal);
        if (pathUsesCloudflareNative(path)) await ensureCloudflareNative();
        const { handleSourceRequest } = await import("../../../server/clientSourceRequest.js");
        const result = await handleSourceRequest(path);
        if (!result || result.kind !== "json") throw new Error(fallbackMessage);
        if (result.status !== 200) throw new Error(result.body.error || fallbackMessage);
        return result.body;
      })(), fallbackMessage)
      : await fetch(path, { signal }).then((response) => readJson(response, fallbackMessage));

    if (ttlMs > 0) writeJsonCache(path, data);
    return data;
  })();

  if (ttlMs > 0) jsonInFlight.set(path, pending);
  try {
    return await pending;
  } finally {
    if (ttlMs > 0) jsonInFlight.delete(path);
  }
}

const jsonResponseCache = new Map();
const jsonInFlight = new Map();

const SEARCH_CACHE_TTL_MS = 120_000;
export const CATALOG_CACHE_TTL_MS = 5 * 60_000;
const CATALOG_STALE_TTL_MS = 10 * 60_000;
const DETAILS_CACHE_TTL_MS = 180_000;
const CHAPTER_CACHE_TTL_MS = 300_000;

function readJsonCache(path, ttlMs, { staleMs = 0 } = {}) {
  const entry = jsonResponseCache.get(path);
  if (!entry) return null;
  const age = Date.now() - entry.at;
  if (age <= ttlMs) return entry.data;
  if (staleMs > 0 && age <= ttlMs + staleMs) return entry.data;
  jsonResponseCache.delete(path);
  return null;
}

function isJsonCacheStale(path, ttlMs, staleMs = 0) {
  const entry = jsonResponseCache.get(path);
  if (!entry) return false;
  const age = Date.now() - entry.at;
  return age > ttlMs && age <= ttlMs + staleMs;
}

function writeJsonCache(path, data) {
  jsonResponseCache.set(path, { at: Date.now(), data });
}

async function refreshJsonCache(path, fallbackMessage) {
  if (jsonInFlight.has(path)) return;
  const pending = (async () => {
    const data = isNative()
      ? await withTimeout((async () => {
        if (pathUsesCloudflareNative(path)) await ensureCloudflareNative();
        const { handleSourceRequest } = await import("../../../server/clientSourceRequest.js");
        const result = await handleSourceRequest(path);
        if (!result || result.kind !== "json") throw new Error(fallbackMessage);
        if (result.status !== 200) throw new Error(result.body.error || fallbackMessage);
        return result.body;
      })(), fallbackMessage)
      : await fetch(path).then((response) => readJson(response, fallbackMessage));
    writeJsonCache(path, data);
    return data;
  })();
  jsonInFlight.set(path, pending);
  try {
    await pending;
  } catch {
    // Conserve la copie stale.
  } finally {
    jsonInFlight.delete(path);
  }
}

export function peekSourceRequest(path, ttlMs) {
  if (!ttlMs) return null;
  return readJsonCache(path, ttlMs);
}

export function clearSourceApiCache(sourceId = "") {
  if (!sourceId) {
    jsonResponseCache.clear();
    return;
  }
  const marker = `/api/sources/${sourceId}/`;
  for (const key of jsonResponseCache.keys()) {
    if (key.includes(marker)) jsonResponseCache.delete(key);
  }
}

function buildCatalogPath(sourceId, { page = 1, genre = "", tag = "", tagPath = "", filterPath = "", queryParam = "", queryValue = "", enrich } = {}) {
  const query = new URLSearchParams({ page: String(page) });
  appendCatalogQueryFilters(query, sourceId, { genre, tag, tagPath, filterPath, queryParam, queryValue });
  appendSourceQueryParams(query, sourceId);
  if (enrich === false || enrich === "0") {
    query.set("enrich", "0");
  } else if (isNative() && enrich !== true && enrich !== "1") {
    query.set("enrich", "0");
  }
  return `${sourcePath(sourceId, "catalog")}?${query}`;
}

export function buildSearchPath(sourceId, query, {
  page = 1,
  genre = "",
  tag = "",
  tagPath = "",
  filterPath = "",
  queryParam = "",
  queryValue = "",
} = {}) {
  const normalized = String(query ?? "").trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  const params = new URLSearchParams({ q: normalized });
  if (page > 1) params.set("page", String(page));
  appendCatalogQueryFilters(params, sourceId, { genre, tag, tagPath, filterPath, queryParam, queryValue });
  appendSourceQueryParams(params, sourceId);
  return `${sourcePath(sourceId, "search")}?${params}`;
}

const imageUrlCache = new Map();
const imageInFlight = new Map();

async function fetchImagePayload(sourceId, url) {
  if (!isNative()) {
    const response = await fetch(sourceImageUrl(sourceId, url));
    if (!response.ok) throw new Error(t("errors.loadImage"));
    const buffer = await response.arrayBuffer();
    return {
      buffer,
      contentType: response.headers.get("content-type") || "image/jpeg",
    };
  }
  if (CLOUDFLARE_NATIVE_SOURCE_IDS.has(sourceId)) await ensureCloudflareNative();
  const { handleSourceRequest } = await import("../../../server/clientSourceRequest.js");
  const result = await handleSourceRequest(sourceImageUrl(sourceId, url));
  if (!result || result.kind !== "image") throw new Error(t("errors.loadImage"));
  return {
    buffer: result.buffer,
    contentType: result.contentType || "image/jpeg",
  };
}

export function peekResolvedImageUrl(sourceId, url) {
  const normalized = normalizeRemoteImageUrl(url);
  if (!normalized) return null;
  if (normalized.startsWith("data:image/")) return normalized;
  if (!sourceId) return normalized;
  if (!isNative()) {
    try {
      if (!isAllowedImageUrl(normalized)) return null;
      assertLiveSourcesAvailable();
      return sourceImageUrl(sourceId, normalized);
    } catch {
      return isAllowedImageUrl(normalized) ? normalized : null;
    }
  }
  return imageUrlCache.get(`${sourceId}:${normalized}`)
    || imageUrlCache.get(`${sourceId}:${url}`)
    || null;
}

export async function resolveSourceImageUrl(sourceId, url) {
  const normalized = normalizeRemoteImageUrl(url);
  if (normalized.startsWith("data:image/")) return normalized;
  if (!isAllowedImageUrl(normalized)) {
    throw new Error(t("errors.imageUrlNotAllowed"));
  }

  if (!isNative()) {
    assertLiveSourcesAvailable();
    return sourceImageUrl(sourceId, normalized);
  }

  const cacheKey = `${sourceId}:${normalized}`;
  if (imageUrlCache.has(cacheKey)) return imageUrlCache.get(cacheKey);

  const inflight = imageInFlight.get(cacheKey);
  if (inflight) return inflight;

  const pending = (async () => {
    const displayUrl = await resolveCachedImage(sourceId, normalized, () => fetchImagePayload(sourceId, normalized));
    imageUrlCache.set(cacheKey, displayUrl);
    return displayUrl;
  })();

  imageInFlight.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    imageInFlight.delete(cacheKey);
  }
}

export function fetchCatalog(sourceId, { page = 1, genre = "", tag = "", tagPath = "", filterPath = "", queryParam = "", queryValue = "", signal } = {}) {
  const path = buildCatalogPath(sourceId, { page, genre, tag, tagPath, filterPath, queryParam, queryValue });
  return requestJson(path, t("errors.loadCatalog"), {
    ttlMs: CATALOG_CACHE_TTL_MS,
    staleMs: CATALOG_STALE_TTL_MS,
    signal,
  });
}

export function peekCatalog(sourceId, options = {}) {
  return peekSourceRequest(buildCatalogPath(sourceId, options), CATALOG_CACHE_TTL_MS);
}

export function prefetchCatalog(sourceId, options = {}) {
  if (!sourceId) return Promise.resolve(null);
  if (options.force !== true && !allowsSpeculativePrefetch()) return Promise.resolve(null);
  return fetchCatalog(sourceId, { page: 1, ...options }).catch(() => null);
}

const FILTERS_CACHE_TTL_MS = 300_000;

function buildFiltersPath(sourceId) {
  const query = new URLSearchParams();
  appendSourceQueryParams(query, sourceId);
  const suffix = query.toString() ? `?${query}` : "";
  return `${sourcePath(sourceId, "filters")}${suffix}`;
}

export function peekSourceFilters(sourceId) {
  const data = peekSourceRequest(buildFiltersPath(sourceId), FILTERS_CACHE_TTL_MS);
  if (!data) return null;
  return {
    categories: data.categories || data.genres || [],
    tags: data.tags || [],
    kinds: data.kinds || [],
  };
}

export function fetchSourceFilters(sourceId) {
  return requestJson(buildFiltersPath(sourceId), t("errors.loadFilters"), { ttlMs: FILTERS_CACHE_TTL_MS });
}

export function searchSource(sourceId, query, {
  page = 1,
  genre = "",
  tag = "",
  tagPath = "",
  filterPath = "",
  queryParam = "",
  queryValue = "",
  signal,
} = {}) {
  const path = buildSearchPath(sourceId, query, { page, genre, tag, tagPath, filterPath, queryParam, queryValue });
  return requestSourceSearch(path, { signal });
}

export function requestSourceSearch(path, { signal } = {}) {
  return requestJson(path, t("errors.searchFailed"), { ttlMs: SEARCH_CACHE_TTL_MS, signal });
}

export function peekSourceSearch(path) {
  return peekSourceRequest(path, SEARCH_CACHE_TTL_MS);
}

export function buildDetailsPath(sourceId, url, item = {}) {
  const query = new URLSearchParams({ url });
  const novelId = Number(item?.novelId || 0);
  if (sourceId === "galaxynovels" && novelId > 0) query.set("novelId", String(novelId));
  appendSourceQueryParams(query, sourceId);
  return `${sourcePath(sourceId, "manga")}?${query}`;
}

export function peekSourceDetails(sourceId, url, item = {}) {
  return peekSourceRequest(buildDetailsPath(sourceId, url, item), DETAILS_CACHE_TTL_MS);
}

export function fetchSourceDetails(sourceId, url, item = {}) {
  return requestJson(buildDetailsPath(sourceId, url, item), t("errors.loadDetails"), { ttlMs: DETAILS_CACHE_TTL_MS });
}

export function buildFollowLatestPath(sourceId, url) {
  const query = new URLSearchParams({ url });
  appendSourceQueryParams(query, sourceId);
  return `${sourcePath(sourceId, "follow-latest")}?${query}`;
}

export function fetchFollowLatest(sourceId, url) {
  return requestJson(buildFollowLatestPath(sourceId, url), t("errors.loadDetails"));
}

function buildChapterPath(sourceId, url, opts = {}) {
  const query = new URLSearchParams({ url });
  if (opts.contentApi) query.set("api", opts.contentApi);
  if (opts.language) query.set("language", opts.language);
  if (opts.seriesUrl && sourceId === "novelsparadise") query.set("series", opts.seriesUrl);
  appendSourceQueryParams(query, sourceId);
  return `${sourcePath(sourceId, "chapter")}?${query}`;
}

export function peekSourceChapter(sourceId, url, options = "") {
  const opts = typeof options === "string" ? { contentApi: options } : (options || {});
  return peekSourceRequest(buildChapterPath(sourceId, url, opts), CHAPTER_CACHE_TTL_MS);
}

export async function fetchSourceChapter(sourceId, url, options = "") {
  const opts = typeof options === "string" ? { contentApi: options } : (options || {});
  if (isNative() && CLOUDFLARE_NATIVE_SOURCE_IDS.has(sourceId)) {
    await ensureCloudflareNative();
  }
  return requestJson(buildChapterPath(sourceId, url, opts), t("errors.loadChapter"), { ttlMs: CHAPTER_CACHE_TTL_MS });
}

export function sourceImageUrl(sourceId, url) {
  const query = new URLSearchParams({ url });
  appendSourceQueryParams(query, sourceId);
  return `${sourcePath(sourceId, "image")}?${query}`;
}

export function sourceEmbedUrl(sourceId, embedUrl, referer = "") {
  return buildSourceEmbedUrl(sourceId, embedUrl, referer, (query) => {
    appendSourceQueryParams(query, sourceId);
  });
}

export function sourceStreamUrl(sourceId, streamUrl, referer = "") {
  if (/drive\.usercontent\.google\.com\/download/i.test(streamUrl)) {
    return streamUrl;
  }
  const query = new URLSearchParams({ url: streamUrl });
  if (referer) query.set("referer", referer);
  appendSourceQueryParams(query, sourceId);
  const path = `${sourcePath(sourceId, "stream")}?${query}`;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export function sourceSubtitleUrl(sourceId, subtitleUrl, referer = "", options = {}) {
  const query = new URLSearchParams({ url: subtitleUrl });
  if (referer) query.set("referer", referer);
  if (options.episodeId) query.set("episodeId", String(options.episodeId));
  appendSourceQueryParams(query, sourceId);
  const path = `${sourcePath(sourceId, "subtitle")}?${query}`;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export function formatSourceError(error, fallback) {
  return toUserFacingError(error, fallback);
}
