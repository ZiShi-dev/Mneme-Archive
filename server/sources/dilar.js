import { fetchProxiedImage } from "../lib/httpUtils.js";
import {
  buildDilarRequestHeaders,
  openDilarPayload,
} from "../lib/dilarCrypto.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/responseJson.js";
import { applyRecentChapterFields, recentChaptersFromCount } from "../lib/catalogChapters.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";

const DEFAULT_BASE_URL = "https://dilar.tube";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
const SOURCE_NAME = "Dilar";
const SOURCE_ID = "dilar";
const UNLOCK_FREE_HEADER = "X-Unlock-Free-Chapter";

const API_HEADERS = {
  "accept-language": "ar,en;q=0.8",
  "user-agent": "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36 Chrome/124 Safari/537.36",
};

async function fetchDilarJson(path, {
  baseUrl = DEFAULT_BASE_URL,
  method = "GET",
  headers = {},
  unlockHeader = "",
  body = null,
} = {}) {
  const apiUrl = `${baseUrl}/api`;
  const requestHeaders = {
    ...API_HEADERS,
    ...await buildDilarRequestHeaders(apiUrl),
    ...headers,
  };
  if (unlockHeader) requestHeaders[UNLOCK_FREE_HEADER] = unlockHeader;
  if (body != null) requestHeaders["Content-Type"] = "application/json";

  const response = await fetch(`${apiUrl}${path}`, {
    method,
    redirect: "follow",
    headers: requestHeaders,
    body: body == null ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(40_000),
  });

  const raw = await response.json().catch(() => ({}));
  const payload = await openDilarPayload(raw, Object.fromEntries(response.headers.entries()), unlockHeader);
  if (!response.ok) {
    const message = payload?.message || payload?.error || payload?.code || `Dilar a répondu ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function assertDilarHost(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("المصدر غير مسموح");
  }
  url.hostname = ctx.apex;
  url.hash = "";
  return url;
}

function assertDilarImageUrl(rawUrl) {
  const url = assertDilarHost(rawUrl);
  if (!url.pathname.startsWith("/uploads/")) throw new Error("رابط الصورة غير مسموح");
  if (url.pathname.includes("..")) throw new Error("رابط الصورة غير مسموح");
  return url.toString();
}

export function buildSeriesUrl(seriesId, baseUrl = DEFAULT_BASE_URL) {
  return `${baseUrl}/mangas/${seriesId}/-`;
}

export function buildChapterUrl(releaseId, baseUrl = DEFAULT_BASE_URL) {
  return `${baseUrl}/chapter/${releaseId}`;
}

export function buildReaderUrl(seriesId, chapterNumber, baseUrl = DEFAULT_BASE_URL) {
  return `${baseUrl}/reader/${seriesId}/-/${encodeURIComponent(chapterNumber)}`;
}

export function seriesIdFromUrl(rawUrl) {
  const url = assertDilarHost(rawUrl);
  const mangasMatch = url.pathname.match(/^\/mangas\/(\d+)/i);
  if (mangasMatch) return mangasMatch[1];
  const seriesMatch = url.pathname.match(/^\/series\/(\d+)/i);
  if (seriesMatch) return seriesMatch[1];
  throw new Error("رابط Dilar غير صالح");
}

export function parseChapterTarget(rawUrl) {
  const url = assertDilarHost(rawUrl);
  const chapterMatch = url.pathname.match(/^\/chapter\/(\d+)/i);
  if (chapterMatch) return { releaseId: chapterMatch[1] };
  const readerMatch = url.pathname.match(/^\/reader\/(\d+)\/[^/]+\/([^/]+)/i);
  if (readerMatch) {
    return {
      seriesId: readerMatch[1],
      chapterNumber: decodeURIComponent(readerMatch[2]),
    };
  }
  throw new Error("رابط فصل Dilar غير صالح");
}

export function releaseIdFromUrl(rawUrl) {
  return parseChapterTarget(rawUrl).releaseId;
}

export function buildCoverUrl(seriesId, coverFile, baseUrl = DEFAULT_BASE_URL) {
  if (!seriesId || !coverFile) return "";
  return `${baseUrl}/uploads/manga/cover/${seriesId}/${coverFile}`;
}

function mapMediaType(series = {}) {
  const typeName = String(series.seriesType?.name || series.seriesType?.title || "").trim();
  if (/رواية|novel/i.test(typeName)) return { mediaType: "novel", mediaTypeLabel: typeName || "رواية" };
  if (/فيلم|movie/i.test(typeName)) return { mediaType: "movie", mediaTypeLabel: typeName || "فيلم" };
  if (/مانهوا|manhwa/i.test(typeName)) return { mediaType: "manga", mediaTypeLabel: typeName || "مانهوا" };
  return { mediaType: "manga", mediaTypeLabel: typeName || "مانغا" };
}

function mapSynonyms(synonyms = {}) {
  const values = Object.values(synonyms || {}).flatMap((entry) => Array.isArray(entry) ? entry : []);
  return values.filter(Boolean).join(" · ");
}

function formatChapterNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value || "").trim();
  if (Number.isInteger(number)) return String(number);
  return String(number).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function splitStorageKey(storageKey = "") {
  let teamId = "";
  let key = String(storageKey || "");
  if (key.includes("/")) {
    const parts = key.split("/");
    teamId = parts[0];
    key = parts.slice(1).join("/");
  }
  return { teamId, storageKey: key };
}

export function buildReleasePageUrl({ teamId, storageKey, pageName, quality = "hq", mediaToken = "" }, baseUrl = DEFAULT_BASE_URL) {
  if (!teamId || !storageKey || !pageName) return "";
  if (/^https?:\/\//i.test(pageName) || pageName.startsWith("//")) return pageName;
  let url = `${baseUrl}/uploads/releases/${teamId}/${storageKey}/${quality}/${pageName}`;
  if (mediaToken) url += `${url.includes("?") ? "&" : "?"}t=${encodeURIComponent(mediaToken)}`;
  return url;
}

export function mapDilarPages(payload = {}, quality = "hq") {
  const pages = Array.isArray(payload.pages) ? payload.pages : [];
  const webpPages = Array.isArray(payload.webp_pages) ? payload.webp_pages : [];
  const mediaToken = typeof payload.media_token === "string" ? payload.media_token : "";
  const { teamId: splitTeamId, storageKey: splitKey } = splitStorageKey(payload.storage_key || "");
  const teamId = payload.init_team_id || payload.teams?.[0]?.id || splitTeamId;
  const storageKey = splitKey;

  if (webpPages.length > 0 && webpPages.every((entry) => typeof entry === "string" && entry.startsWith("http"))) {
    return webpPages.map((src, index) => ({
      src,
      alt: `Page ${index + 1}`,
    }));
  }

  return pages.map((page, index) => {
    const pageName = typeof page === "string" ? page : page?.url || page?.name || "";
    const dir = typeof page === "object" && typeof page?.dir === "string" && page.dir.trim() ? page.dir.trim() : quality;
    const webpCandidate = webpPages[index];
    const src = buildReleasePageUrl({
      teamId,
      storageKey,
      pageName,
      quality: dir,
      mediaToken,
    }) || (typeof webpCandidate === "string" ? webpCandidate : "");
    return {
      src,
      alt: `Page ${index + 1}`,
    };
  }).filter((page) => page.src);
}

function pickPrimaryRelease(entry = {}) {
  const releases = Array.isArray(entry.releases) ? entry.releases : [];
  return releases[0] || null;
}

function mapChapterEntry(entry, seriesId) {
  const release = pickPrimaryRelease(entry);
  const releaseId = String(release?.id || entry.release_id || "");
  const chapterizationId = String(entry.id || entry.chapterization_id || "");
  const number = formatChapterNumber(entry.chapter ?? entry.number ?? entry.latestChapter?.chapter);
  const chapterUrl = releaseId
    ? buildChapterUrl(releaseId)
    : seriesId && number
      ? buildReaderUrl(seriesId, number)
      : null;
  return {
    url: chapterUrl,
    name: entry.title ? `${number} · ${entry.title}` : number,
    number,
    date: entry.created_at || entry.updated_at || "",
    releaseId,
    chapterizationId,
    seriesId: String(seriesId || entry.series_id || ""),
  };
}

export function mapCatalogItem(series = {}) {
  const seriesId = String(series.id || "");
  const latest = series.latestChapter || {};
  const latestNumber = formatChapterNumber(latest.chapter);
  const media = mapMediaType(series);
  const totalChapters = Math.max(
    Number(series.chapters_count || series.chapter_count || series.total_chapters || 0),
    Number(latestNumber) || 0,
  );
  const recentChapters = recentChaptersFromCount(totalChapters, (number) => (
    seriesId ? buildReaderUrl(seriesId, number) : null
  ));
  return applyRecentChapterFields({
    id: seriesId,
    title: series.title || "",
    altTitle: mapSynonyms(series.synonyms),
    url: buildSeriesUrl(seriesId),
    cover: buildCoverUrl(seriesId, series.cover),
    summary: series.summary || "",
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    ...media,
  }, recentChapters);
}

export function mapDilarDetails(series = {}, chapters = [], releases = []) {
  const seriesId = String(series.id || "");
  const media = mapMediaType(series);
  const chapterEntries = chapters.length
    ? chapters
    : releases.map((entry) => ({
      id: entry.chapterization_id || entry.id,
      chapter: entry.chapter,
      title: entry.title,
      created_at: entry.created_at,
      series_id: seriesId,
    }));

  const mappedChapters = chapterEntries
    .map((entry) => mapChapterEntry(entry, seriesId))
    .filter((entry) => entry.url)
    .sort((a, b) => Number(b.number) - Number(a.number));

  const categories = (series.categories || []).map((entry) => entry?.name || entry?.title || "").filter(Boolean);
  const tags = (series.tags || []).map((entry) => entry?.name || entry?.title || "").filter(Boolean);

  return {
    id: seriesId,
    title: series.title || "",
    altTitle: mapSynonyms(series.synonyms),
    cover: buildCoverUrl(seriesId, series.cover),
    summary: series.summary || "",
    url: buildSeriesUrl(seriesId),
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    ...media,
    categories,
    tags,
    chapters: mappedChapters.reverse(),
  };
}

export function parseDilarChapter(payload, url) {
  const pages = mapDilarPages(payload);
  const number = formatChapterNumber(payload.chapter?.chapter ?? payload.chapter);
  const title = payload.chapter?.title || payload.title || number || "فصل";
  return {
    title,
    url,
    kind: "manga",
    pages,
    paragraphs: [],
  };
}

async function resolveReleaseId(target, baseUrl = DEFAULT_BASE_URL) {
  if (target.releaseId) return target.releaseId;
  const chaptersPayload = await fetchDilarJson(`/series/${target.seriesId}/chapters`, { baseUrl });
  const chapters = chaptersPayload.chapters || [];
  const needle = formatChapterNumber(target.chapterNumber);
  const match = chapters.find((entry) => formatChapterNumber(entry.chapter) === needle);
  const release = pickPrimaryRelease(match);
  if (!release?.id) throw new Error("الفصل غير موجود على Dilar");
  return String(release.id);
}

async function requestFreePass(releaseId, baseUrl = DEFAULT_BASE_URL) {
  const payload = await fetchDilarJson(`/chapters/${releaseId}/unlock/free`, { baseUrl, method: "POST", body: {} });
  const token = typeof payload?.token === "string" ? payload.token.trim() : "";
  if (!token) throw new Error("تعذر فتح الفصل المجاني على Dilar");
  return token;
}

async function requestMediaGrant(releaseId, freePassToken, baseUrl = DEFAULT_BASE_URL) {
  return fetchDilarJson(`/releases/${releaseId}/grant`, {
    baseUrl,
    method: "POST",
    body: {},
    headers: {
      "X-Scheme-Caps": "1",
      "X-Unlock-Free-Chapter": freePassToken,
    },
    unlockHeader: freePassToken,
  });
}

async function fetchChapterPayload(releaseId, baseUrl = DEFAULT_BASE_URL) {
  let payload = await fetchDilarJson(`/chapters/${releaseId}`, { baseUrl });
  if (payload.pages?.length) return payload;

  const needsUnlock = payload.free_pass_required || payload.encoded || !payload.storage_key;
  if (!needsUnlock) return payload;

  const freePassToken = await requestFreePass(releaseId, baseUrl);
  const grant = await requestMediaGrant(releaseId, freePassToken, baseUrl);
  const mediaGrant = typeof grant.grant === "string" ? grant.grant : "";
  if (!mediaGrant) throw new Error("تعذر الحصول على حق قراءة Dilar");

  payload = await fetchDilarJson(`/chapters/${releaseId}`, {
    baseUrl,
    headers: {
      "X-Media-Grant": mediaGrant,
      "X-Unlock-Free-Chapter": freePassToken,
    },
    unlockHeader: freePassToken,
  });

  if (!payload.pages?.length && grant.pages?.length) {
    const { teamId } = splitStorageKey(grant.storageKey || "");
    payload = {
      ...payload,
      pages: grant.pages,
      storage_key: grant.storageKey,
      init_team_id: teamId || payload.init_team_id,
    };
  }

  return payload;
}

async function fetchSeriesList({ page = 1, path = "/series", baseUrl = DEFAULT_BASE_URL } = {}) {
  const query = new URLSearchParams({ page: String(page) });
  const suffix = `${path}?${query}`;
  const payload = await fetchDilarJson(suffix.startsWith("/") ? suffix : `/${suffix}`, { baseUrl });
  const series = payload.series || payload.data?.series || payload.data || [];
  const items = Array.isArray(series) ? series.map((entry) => mapCatalogItem(entry)) : [];
  const totalPages = Number(payload.totalPages || payload.total_pages || 0);
  const currentPage = Number(payload.currentPage || payload.current_page || page);
  const hasMore = totalPages > 0 ? currentPage < totalPages : items.length > 0;
  return { items, page: currentPage, hasMore, totalPages };
}

export async function handleDilarRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: SOURCE_NAME });
  const { baseUrl } = ctx;

  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(assertDilarImageUrl(requestUrl.searchParams.get("url") ?? ""), `${baseUrl}/`, SOURCE_NAME);
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const payload = await fetchDilarJson("/categories", { baseUrl });
    const groups = Array.isArray(payload) ? payload : payload.data || payload.categories || [];
    const categories = [];
    for (const group of groups) {
      for (const entry of group.categories || []) {
        categories.push({
          slug: String(entry.id || entry.slug || ""),
          name: entry.name || entry.title || "",
          count: Number(entry.series_count || entry.count || 0),
          group: group.name || group.title || "",
        });
      }
    }
    return responseJson(200, { categories, tags: [], fetchedAt: new Date().toISOString() });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() || "";
    const path = genre ? `/series/category/${encodeURIComponent(genre)}` : "/series";
    const result = await fetchSeriesList({ page, path, baseUrl });
    return responseJson(200, {
      items: result.items,
      page: result.page,
      genre,
      hasMore: result.hasMore,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 100);
    const payload = await fetchDilarJson(`/series/search?q=${encodeURIComponent(query)}&page=${page}`, { baseUrl });
    const series = payload.series || payload.data?.series || payload.data || [];
    const items = Array.isArray(series) ? series.map((entry) => mapCatalogItem(entry)) : [];
    const totalPages = Number(payload.totalPages || payload.total_pages || 0);
    const currentPage = Number(payload.currentPage || payload.current_page || page);
    return responseJson(200, {
      items,
      page: currentPage,
      hasMore: totalPages > 0 ? currentPage < totalPages : items.length > 0,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const seriesId = seriesIdFromUrl(requestUrl.searchParams.get("url") ?? "");
    const [seriesPayload, chaptersPayload] = await Promise.all([
      fetchDilarJson(`/series/${seriesId}`, { baseUrl }),
      fetchDilarJson(`/series/${seriesId}/chapters`, { baseUrl }),
    ]);
    const series = seriesPayload.series || seriesPayload.data || seriesPayload;
    const chapters = chaptersPayload.chapters || chaptersPayload.data?.chapters || [];
    const releases = chaptersPayload.releases || chaptersPayload.data?.releases || [];
    return responseJson(200, mapDilarDetails(series, chapters, releases));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const chapterUrl = requestUrl.searchParams.get("url") ?? "";
    const target = parseChapterTarget(chapterUrl);
    const releaseId = await resolveReleaseId(target, baseUrl);
    const payload = await fetchChapterPayload(releaseId, baseUrl);
    const resolvedUrl = chapterUrl.includes("/chapter/")
      ? buildChapterUrl(releaseId)
      : buildReaderUrl(target.seriesId || payload.series_id, formatChapterNumber(payload.chapter?.chapter ?? target.chapterNumber));
    return responseJson(200, parseDilarChapter(payload, resolvedUrl));
  }

  return responseJson(404, { error: "Route Dilar inconnue" });
}
