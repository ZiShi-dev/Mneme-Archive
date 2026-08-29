import { resolveCachedImage } from "../../lib/storage/imageCache";
import { isAllowedImageUrl } from "../../lib/storage/security";
import { assertLiveSourcesAvailable } from "../../lib/platform/liveSources";
import { toUserFacingError } from "../../lib/errors/userFacingError";
import { t } from "../../i18n/runtime.js";
import { MAX_SEARCH_QUERY_LENGTH } from "../../../server/lib/queryLimits.js";
import { Capacitor } from "@capacitor/core";
import { getRuntimeSettings } from "../../lib/settings/runtimeSettings.js";
import { getDefaultSourceBaseUrl, getEffectiveSourceBaseUrl } from "../../lib/settings/sourceBaseUrls.js";
import { WEBVIEW_SOURCE_ID_SET } from "../../lib/platform/webViewSources.js";

const FILTER_PATH_SOURCES = new Set([
  "galaxynovels", "cenele", "anime4up", "animedar", "animesama", "frenchstream", "wiflix", "coflix",
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
  for (const sourceId of WEBVIEW_SOURCE_ID_SET) {
    if (path.includes(`/api/sources/${sourceId}/`)) return true;
  }
  return false;
}

const GENRE_FILTER_SOURCES = [
  "mangalik", "azorafly", "novelsparadise", "nightnovel",
  "kolnovel", "dilar",
];
const TAG_FILTER_SOURCES = [
  "mangalik", "novelsparadise", "nightnovel",
  "kolnovel",
];

let cloudflareNativeReady = false;

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

async function requestJson(path, fallbackMessage, { ttlMs = 0 } = {}) {
  assertLiveSourcesAvailable();
  if (ttlMs > 0) {
    const cached = readJsonCache(path, ttlMs);
    if (cached) return cached;
  }

  const data = isNative()
    ? await (async () => {
      if (pathUsesCloudflareNative(path)) await ensureCloudflareNative();
      const { handleSourceRequest } = await import("../../../server/mangaSourcesPlugin.js");
      const result = await handleSourceRequest(path);
      if (!result || result.kind !== "json") throw new Error(fallbackMessage);
      if (result.status !== 200) throw new Error(result.body.error || fallbackMessage);
      return result.body;
    })()
    : await fetch(path).then((response) => readJson(response, fallbackMessage));

  if (ttlMs > 0) writeJsonCache(path, data);
  return data;
}

const jsonResponseCache = new Map();

function readJsonCache(path, ttlMs) {
  const entry = jsonResponseCache.get(path);
  if (!entry) return null;
  if (Date.now() - entry.at > ttlMs) {
    jsonResponseCache.delete(path);
    return null;
  }
  return entry.data;
}

function writeJsonCache(path, data) {
  jsonResponseCache.set(path, { at: Date.now(), data });
}

export function clearSourceApiCache() {
  jsonResponseCache.clear();
}

const imageUrlCache = new Map();

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
  if (WEBVIEW_SOURCE_ID_SET.has(sourceId)) await ensureCloudflareNative();
  const { handleSourceRequest } = await import("../../../server/mangaSourcesPlugin.js");
  const result = await handleSourceRequest(sourceImageUrl(sourceId, url));
  if (!result || result.kind !== "image") throw new Error(t("errors.loadImage"));
  return {
    buffer: result.buffer,
    contentType: result.contentType || "image/jpeg",
  };
}

export async function resolveSourceImageUrl(sourceId, url) {
  if (!isAllowedImageUrl(url)) {
    throw new Error(t("errors.imageUrlNotAllowed"));
  }

  if (!isNative()) {
    assertLiveSourcesAvailable();
    return sourceImageUrl(sourceId, url);
  }

  const cacheKey = `${sourceId}:${url}`;
  if (imageUrlCache.has(cacheKey)) return imageUrlCache.get(cacheKey);

  const displayUrl = await resolveCachedImage(sourceId, url, () => fetchImagePayload(sourceId, url));
  imageUrlCache.set(cacheKey, displayUrl);
  return displayUrl;
}

export function fetchCatalog(sourceId, { page = 1, genre = "", tag = "", tagPath = "", filterPath = "", queryParam = "", queryValue = "" } = {}) {
  const query = new URLSearchParams({ page: String(page) });
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
  appendSourceQueryParams(query, sourceId);
  return requestJson(`${sourcePath(sourceId, "catalog")}?${query}`, t("errors.loadCatalog"), { ttlMs: 90_000 });
}

export function fetchSourceFilters(sourceId) {
  const query = new URLSearchParams();
  appendSourceQueryParams(query, sourceId);
  const suffix = query.toString() ? `?${query}` : "";
  return requestJson(`${sourcePath(sourceId, "filters")}${suffix}`, t("errors.loadFilters"), { ttlMs: 300_000 });
}

export function searchSource(sourceId, query, {
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
  if (GENRE_FILTER_SOURCES.includes(sourceId) && genre) {
    params.set("genre", genre);
  }
  if (TAG_FILTER_SOURCES.includes(sourceId) && tag) {
    params.set("tag", tag);
    if (tagPath) params.set("tagPath", tagPath);
  }
  if (FILTER_PATH_SOURCES.has(sourceId) && filterPath) {
    params.set("filterPath", filterPath);
    if (queryParam && queryValue) {
      params.set("queryParam", queryParam);
      params.set("queryValue", queryValue);
    }
  }
  appendSourceQueryParams(params, sourceId);
  return requestJson(`${sourcePath(sourceId, "search")}?${params}`, t("errors.searchFailed"), { ttlMs: 120_000 });
}

export function fetchSourceDetails(sourceId, url) {
  const query = new URLSearchParams({ url });
  appendSourceQueryParams(query, sourceId);
  const path = `${sourcePath(sourceId, "manga")}?${query}`;
  return requestJson(path, t("errors.loadDetails"), { ttlMs: 180_000 });
}

async function fetchParadiseChapterNative(url, seriesUrl = "") {
  const { ParadiseChapterFetcher } = await import("../../plugins/paradiseChapterFetcher.js");
  const result = await ParadiseChapterFetcher.fetchChapter({ url, seriesUrl });
  const paragraphs = Array.isArray(result?.paragraphs) ? result.paragraphs.filter(Boolean) : [];
  if (!paragraphs.length) throw new Error(t("errors.extractChapter"));
  return {
    title: result.title || t("errors.chapterFallback"),
    url: result.url || url,
    kind: "novel",
    paragraphs,
    pages: [],
  };
}

export async function fetchSourceChapter(sourceId, url, options = "") {
  const opts = typeof options === "string" ? { contentApi: options } : (options || {});
  if (isNative() && sourceId === "novelsparadise") {
    return fetchParadiseChapterNative(url, opts.seriesUrl || "");
  }
  const query = new URLSearchParams({ url });
  if (opts.contentApi) query.set("api", opts.contentApi);
  if (opts.language) query.set("language", opts.language);
  if (opts.seriesUrl && sourceId === "novelsparadise") query.set("series", opts.seriesUrl);
  appendSourceQueryParams(query, sourceId);
  return requestJson(`${sourcePath(sourceId, "chapter")}?${query}`, t("errors.loadChapter"));
}

export function sourceImageUrl(sourceId, url) {
  const query = new URLSearchParams({ url });
  appendSourceQueryParams(query, sourceId);
  return `${sourcePath(sourceId, "image")}?${query}`;
}

export function sourceStreamUrl(sourceId, streamUrl, referer = "") {
  const query = new URLSearchParams({ url: streamUrl });
  if (referer) query.set("referer", referer);
  appendSourceQueryParams(query, sourceId);
  const path = `${sourcePath(sourceId, "stream")}?${query}`;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export function sourceSubtitleUrl(sourceId, subtitleUrl, referer = "") {
  const query = new URLSearchParams({ url: subtitleUrl });
  if (referer) query.set("referer", referer);
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
