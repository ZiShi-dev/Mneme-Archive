import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage, fetchWithRetries } from "../lib/httpUtils.js";
import { fetchProxiedHlsResource } from "../lib/hlsProxy.js";
import {
  assertProxiedStreamUrl,
  enrichSourcesWithStreams,
  resolveEmbedDirectStream,
} from "../lib/embedResolvers.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/responseJson.js";
import { applyRecentChapterFields } from "../lib/catalogChapters.js";
import { sortSourcesByVideoHost } from "../lib/videoHosts.js";
import { resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";
import {
  assertChapterUrl,
  assertFilterPath,
  assertMovieUrl,
  BROWSER_UA,
  DEFAULT_BASE_URL,
  DEFAULT_CTX,
  episodeNumberFromUrl,
  MIXED_PATH,
  newsIdFromUrl,
  normalizeFrenchStreamAudioLabel,
  normalizeFrenchStreamUrl,
  SOURCE_ID,
  SOURCE_NAME,
  watchEntry,
} from "./frenchstreamCore.js";
import {
  clearFrenchStreamEpisodeCaches,
  episodeBucket,
  episodeToPlayers,
  fetchFrenchStreamEpisodeData,
  firstPlayableEpisode,
  frenchStreamAudioLanguagesFromEpisodeData,
  parseFrenchStreamSeriesChapters,
  rememberFrenchStreamEpisodeData,
} from "./frenchstreamEpisodes.js";
import {
  clearFrenchStreamCatalogCaches,
  enrichFrenchStreamCatalog,
  fetchFrenchStreamCatalogPage,
  fetchFrenchStreamFilters,
  fetchFrenchStreamSearchHtmlCached,
  fetchRelatedFrenchStreamMovies,
  FRENCH_STREAM_CATALOG_PAGE_SIZE,
  frenchStreamSeriesNeedsEnrich,
  isRelatedFrenchStreamTitle,
  parseFrenchStreamCatalog,
  parseFrenchStreamFilters,
  parseFrenchStreamSearch,
  pickRelatedFrenchStreamMovies,
  relatedSearchQuery,
  searchHasMore,
} from "./frenchstreamCatalog.js";

export { decodePackedPlayerSource, extractPackedPlayerStreamUrl } from "../lib/embedResolvers.js";
export {
  FRENCH_STREAM_CATALOG_PAGE_SIZE,
  enrichFrenchStreamCatalog,
  fetchFrenchStreamCatalogPage,
  frenchStreamSeriesNeedsEnrich,
  isRelatedFrenchStreamTitle,
  parseFrenchStreamCatalog,
  parseFrenchStreamFilters,
  parseFrenchStreamSearch,
  pickRelatedFrenchStreamMovies,
  relatedSearchQuery,
} from "./frenchstreamCatalog.js";
export {
  episodeToPlayers,
  frenchStreamAudioLanguagesFromEpisodeData,
  parseFrenchStreamSeriesChapters,
  rememberFrenchStreamEpisodeData,
} from "./frenchstreamEpisodes.js";
export {
  assertChapterUrl,
  assertMovieUrl,
  episodeNumberFromUrl,
  newsIdFromUrl,
  normalizeFrenchStreamAudioLabel,
  normalizeFrenchStreamUrl,
} from "./frenchstreamCore.js";

const FRENCH_STREAM_CATALOG_HTML_CACHE_TTL_MS = 5 * 60_000;

const IMAGE_HOSTS = new Set([
  DEFAULT_CTX.apex,
  DEFAULT_CTX.hostname,
  `www.${DEFAULT_CTX.apex}`,
  "image.tmdb.org",
  "i.imgur.com",
  "imgur.com",
]);

const PLAYER_HOST_ORDER = [
  /vidzy\./i,
  /fsvid\./i,
  /uqload\./i,
  /voe/i,
  /dood/i,
  /kakaflix/i,
];
const PLAYER_LABELS = {
  premium: "Premium",
  vidzy: "Vidzy",
  uqload: "Uqload",
  dood: "Dood",
  netu: "Netu",
  voe: "VOE",
  filmoon: "Filmoon",
};
const LANG_LABELS = {
  default: "VF",
  vostfr: "VOSTFR",
  vfq: "VFQ",
  vff: "VFF",
  vo: "VO",
};

function createFrenchStreamFetcher(baseUrl = DEFAULT_BASE_URL) {
  return createCachedHtmlFetcher({
    ttlMs: FRENCH_STREAM_CATALOG_HTML_CACHE_TTL_MS,
    timeoutMs: 40_000,
    retries: 2,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.6",
      referer: `${baseUrl}/`,
      "user-agent": BROWSER_UA,
    },
    getVariants: (url) => [url],
    buildError: (lastStatus) => `French Stream a répondu ${lastStatus || "sans réponse"}`,
  });
}

function buildFrenchStreamStreamProxyPath(targetUrl, referer = "") {
  const params = new URLSearchParams({ url: targetUrl });
  if (referer) params.set("referer", referer);
  return `/api/sources/${SOURCE_ID}/stream?${params}`;
}

export function assertFrenchStreamStreamUrl(rawUrl = "") {
  return assertProxiedStreamUrl(rawUrl);
}

export function assertFrenchStreamStreamReferer(rawUrl = "") {
  const decoded = decodeHtml(rawUrl);
  if (!decoded) throw new Error("مرجع البث غير صالح");
  const url = new URL(decoded);
  if (url.protocol !== "https:") throw new Error("مرجع البث غير صالح");
  url.hash = "";
  return url.toString();
}

export async function resolveFrenchStreamDirectStream(embedUrl = "") {
  return resolveEmbedDirectStream(embedUrl);
}

export function assertFrenchStreamImageUrl(rawUrl) {
  const decoded = decodeHtml(rawUrl);
  let url;
  try {
    url = new URL(decoded);
  } catch {
    throw new Error("رابط الصورة غير مسموح");
  }
  if (url.protocol !== "https:" || !IMAGE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("رابط الصورة غير مسموح");
  }
  return url.toString();
}

export function clearFrenchStreamPerformanceCaches() {
  clearFrenchStreamEpisodeCaches();
  clearFrenchStreamCatalogCaches();
}

export function parseFrenchStreamDetails(html, url) {
  if (/id=["']serie-data["']/i.test(html)) return parseFrenchStreamSeriesDetails(html, url);
  return parseFrenchStreamMovieDetails(html, url);
}

function parseFrenchStreamGenres(html = "") {
  const genresBlock = html.match(/<span class="genres">([\s\S]*?)<\/span>/i)?.[1] ?? "";
  const fromLinks = [];
  for (const match of genresBlock.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = textOnly(match[1]);
    if (label && !fromLinks.includes(label)) fromLinks.push(label);
  }
  if (fromLinks.length) return fromLinks;
  return textOnly(genresBlock).split(/[,،]/).map((entry) => entry.trim()).filter(Boolean);
}

function parseFrenchStreamYear(html = "") {
  return textOnly(html.match(/xfname=date-de-sortie[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "")
    || (html.match(/date-de-sortie\/(\d{4})/i)?.[1] ?? "");
}

function parseSerieTag(html = "") {
  const fromQuery = decodeHtml(html.match(/xfname=tagz[^"']*xf=([sS]-[a-z0-9_-]+)/i)?.[1] ?? "");
  if (fromQuery) return fromQuery;
  const fromText = textOnly(html.match(/class="sd-tagz"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
  return fromText.match(/s-[a-z0-9_-]+/i)?.[0] || "";
}

function parseDetailsAudio(html = "") {
  const version = textOnly(
    html.match(/id="film_lang"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
    ?? html.match(/xfname=version-(?:film|serie)[^>]*>([\s\S]*?)<\/a>/i)?.[1]
    ?? html.match(/<span class="film-version">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
    ?? "",
  );
  return { version, audioLabel: normalizeFrenchStreamAudioLabel(version) };
}

function parseFrenchStreamMovieDetails(html, url) {
  const canonical = assertMovieUrl(url);
  const newsId = newsIdFromUrl(canonical);
  const dataBlock = html.match(/<div id="film-data"([^>]*)>/i)?.[1] ?? "";
  const attr = (name) => decodeHtml(dataBlock.match(new RegExp(`data-${name}="([^"]*)"`, "i"))?.[1] ?? "");
  const title = textOnly(
    html.match(/<h1[^>]*id="s-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? attr("title")
      ?? html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.split("|")[0]
      ?? "",
  ).replace(/\s*-\s*\d{4}\s*$/, "").trim();
  const cover = attr("affiche") || decodeHtml(html.match(/<img[^>]*class="[^"]*dvd-thumbnail[^"]*"[^>]*src="([^"]+)"/i)?.[1] ?? "");
  const summary = textOnly(
    html.match(/<div class="fdesc[^"]*"[^>]*>[\s\S]*?<\/p>([\s\S]*?)<\/div>/i)?.[1]
      ?? "",
  );
  const year = parseFrenchStreamYear(html);
  const runtime = textOnly(html.match(/<span class="runtime">([\s\S]*?)<\/span>/i)?.[1] ?? "").replace(/^-\s*/, "");
  const { version, audioLabel } = parseDetailsAudio(html);
  const quality = textOnly(html.match(/id="film_quality"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
  const watch = watchEntry(canonical, quality || "1");
  return {
    id: newsId,
    title,
    altTitle: [year, runtime, audioLabel || version].filter(Boolean).join(" · "),
    cover,
    summary,
    url: canonical,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "movie",
    mediaTypeLabel: "فيلم",
    audioLabel,
    categories: parseFrenchStreamGenres(html).slice(0, 20),
    tags: [audioLabel || version, quality].filter(Boolean),
    totalEpisodes: 1,
    year,
    relatedItems: [],
    chapters: [watch],
    latestChapter: watch.number,
    latestChapterUrl: watch.url,
    recentChapters: [watch],
  };
}

function parseFrenchStreamSeriesDetails(html, url) {
  const canonical = assertMovieUrl(url);
  const newsId = newsIdFromUrl(canonical);
  const dataBlock = html.match(/<div id="serie-data"([^>]*)>/i)?.[1] ?? "";
  const attr = (name) => decodeHtml(dataBlock.match(new RegExp(`data-${name}="([^"]*)"`, "i"))?.[1] ?? "");
  const title = textOnly(
    html.match(/<h1[^>]*id="s-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? attr("title")
      ?? html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.split("|")[0]
      ?? "",
  ).replace(/\s*-\s*\d{4}\s*$/, "").trim();
  const cover = attr("affiche") || decodeHtml(html.match(/<img[^>]*class="[^"]*dvd-thumbnail[^"]*"[^>]*src="([^"]+)"/i)?.[1] ?? "");
  const summary = textOnly(html.match(/<div class="fdesc[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const year = parseFrenchStreamYear(html);
  const runtime = textOnly(html.match(/<span class="runtime">([\s\S]*?)<\/span>/i)?.[1] ?? "").replace(/^-\s*/, "");
  const { version, audioLabel } = parseDetailsAudio(html);
  return {
    id: newsId,
    title,
    altTitle: [year, runtime, audioLabel || version].filter(Boolean).join(" · "),
    cover,
    summary,
    url: canonical,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "series",
    mediaTypeLabel: "مسلسل",
    audioLabel,
    categories: parseFrenchStreamGenres(html).slice(0, 20),
    tags: [audioLabel].filter(Boolean),
    totalEpisodes: 0,
    year,
    serieTag: parseSerieTag(html),
    relatedItems: [],
    chapters: [],
    latestChapter: "—",
    latestChapterUrl: null,
    recentChapters: [],
  };
}

function frenchStreamAudioLabelFromLanguages(languages = [], fallback = "") {
  if (languages.includes("VF") && languages.includes("VOSTFR")) return "VF+VOSTFR";
  if (languages.length === 1) return languages[0];
  return fallback;
}

function attachFrenchStreamChapterAudioLanguages(chapter, audioLanguages = {}) {
  const entries = Object.entries(audioLanguages).filter(([, url]) => Boolean(url));
  if (!entries.length) return chapter;
  return {
    ...chapter,
    audioLanguages: Object.fromEntries(entries),
  };
}

function seasonNumberFromTitle(title = "") {
  const match = String(title).match(/saison\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

export function pickRelatedFrenchStreamSeasons(seasons = [], currentId) {
  const current = String(currentId || "");
  return (Array.isArray(seasons) ? seasons : [])
    .filter((season) => season && String(season.id) !== current && (season.full_url || season.url))
    .sort((left, right) => seasonNumberFromTitle(left.title) - seasonNumberFromTitle(right.title))
    .map((season) => {
      const rawUrl = season.full_url || season.url || "";
      const url = normalizeFrenchStreamUrl(rawUrl.startsWith("http") || rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`);
      if (!url) return null;
      return {
        id: String(season.id),
        title: season.title,
        altTitle: String(season.title || "").match(/saison\s+\d+/i)?.[0] || "",
        url,
        cover: season.affiche || season.cover || "",
        source: SOURCE_NAME,
        sourceId: SOURCE_ID,
        mediaType: "series",
        mediaTypeLabel: "مسلسل",
        year: "",
      };
    })
    .filter(Boolean);
}

export function flattenFrenchStreamPlayers(players = {}, language = "") {
  const normalizedLanguage = String(language || "").toUpperCase();
  const langKey = normalizedLanguage === "VOSTFR"
    ? "vostfr"
    : normalizedLanguage === "VO"
      ? "vo"
      : normalizedLanguage === "VF"
        ? "default"
        : "";
  const sources = [];
  const seen = new Set();
  for (const [hostKey, variants] of Object.entries(players)) {
    if (!variants || typeof variants !== "object") continue;
    const entries = langKey
      ? Object.entries(variants).filter(([key]) => key === langKey)
      : Object.entries(variants);
    for (const [langKeyEntry, rawUrl] of entries) {
      const url = String(rawUrl || "").trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const host = PLAYER_LABELS[hostKey] || hostKey;
      const lang = LANG_LABELS[langKeyEntry] || langKeyEntry;
      sources.push({
        label: lang && lang !== "VF" ? `${host} ${lang}` : host,
        url,
        audioLabel: lang,
      });
    }
  }
  return sortSourcesByVideoHost(sources, (entry) => entry.url, PLAYER_HOST_ORDER);
}

export function frenchStreamAudioLanguagesFromPlayers(players = {}) {
  const languages = [];
  if (flattenFrenchStreamPlayers(players, "VF").length) languages.push("VF");
  if (flattenFrenchStreamPlayers(players, "VOSTFR").length) languages.push("VOSTFR");
  return languages;
}

export function parseFrenchStreamPlayback(api, details, language = "") {
  const sources = flattenFrenchStreamPlayers(api?.players, language);
  const embedUrl = sources[0]?.url || "";
  if (!embedUrl) throw new Error("تعذر استخراج مشغل الفيلم");
  return {
    title: details.title,
    url: details.url,
    kind: "video",
    embedUrl,
    playerUrl: details.url,
    sources,
  };
}

async function enrichFrenchStreamPlayback(api, details, language = "") {
  const playback = parseFrenchStreamPlayback(api, details, language);
  const sources = await enrichSourcesWithStreams(playback.sources, details.url || playback.url);
  const playable = sources.find((entry) => entry.streamUrl);
  return {
    ...playback,
    sources,
    streamUrl: playable?.streamUrl || "",
    videoUrl: playable?.streamUrl || "",
    streamReferer: playable?.streamReferer || "",
    playbackMode: playable ? "hls" : "embed",
    embedUrl: playable ? "" : playback.embedUrl,
  };
}

async function fetchFilmApi(newsId) {
  const response = await fetchWithRetries(`${DEFAULT_BASE_URL}/engine/ajax/film_api.php?id=${encodeURIComponent(newsId)}`, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      referer: `${DEFAULT_BASE_URL}/index.php?newsid=${newsId}`,
      "user-agent": BROWSER_UA,
      "x-requested-with": "XMLHttpRequest",
    },
    timeoutMs: 25_000,
  }, 2);
  if (!response.ok) throw new Error(`French Stream a répondu ${response.status}`);
  return response.json();
}

async function fetchRelatedSeasons(serieTag, currentId) {
  if (!serieTag) return [];
  try {
    const response = await fetchWithRetries(
      `${DEFAULT_BASE_URL}/engine/ajax/get_seasons.php?serie_tag=${encodeURIComponent(serieTag)}&news_id=${encodeURIComponent(currentId)}`,
      {
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          referer: `${DEFAULT_BASE_URL}/index.php?newsid=${currentId}`,
          "user-agent": BROWSER_UA,
          "x-requested-with": "XMLHttpRequest",
        },
        timeoutMs: 20_000,
      },
      1,
    );
    if (!response.ok) return [];
    return pickRelatedFrenchStreamSeasons(await response.json(), currentId);
  } catch {
    return [];
  }
}

export async function handleFrenchStreamRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: SOURCE_NAME });
  const fetchFrenchStreamHtml = createFrenchStreamFetcher(ctx.baseUrl);

  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(assertFrenchStreamImageUrl(requestUrl.searchParams.get("url") ?? ""), `${ctx.baseUrl}/`, SOURCE_NAME);
  }

  if (requestUrl.pathname.endsWith("/stream")) {
    const target = assertFrenchStreamStreamUrl(requestUrl.searchParams.get("url") ?? "");
    const referer = assertFrenchStreamStreamReferer(requestUrl.searchParams.get("referer") ?? "");
    return fetchProxiedHlsResource({
      target,
      referer,
      label: SOURCE_NAME,
      buildProxyUrl: (entry) => buildFrenchStreamStreamProxyPath(entry, referer),
    });
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    return responseJson(200, await fetchFrenchStreamFilters(fetchFrenchStreamHtml, ctx.baseUrl));
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 2000);
    const filterPath = assertFilterPath(requestUrl.searchParams.get("filterPath")?.trim() || MIXED_PATH);
    const payload = await fetchFrenchStreamCatalogPage(ctx, fetchFrenchStreamHtml, { page, filterPath });
    return responseJson(200, payload);
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 2000);
    const filterPath = assertFilterPath(requestUrl.searchParams.get("filterPath")?.trim() || MIXED_PATH);
    if (filterPath !== MIXED_PATH) {
      const payload = await fetchFrenchStreamCatalogPage(ctx, fetchFrenchStreamHtml, { page, filterPath });
      const needle = query.toLocaleLowerCase("fr");
      const items = payload.items.filter((item) => (
        `${item.title || ""} ${item.altTitle || ""} ${item.year || ""}`.toLocaleLowerCase("fr").includes(needle)
      ));
      return responseJson(200, {
        items,
        page,
        filterPath,
        hasMore: payload.hasMore,
        fetchedAt: payload.fetchedAt,
      });
    }
    const html = await fetchFrenchStreamSearchHtmlCached(query, ctx.baseUrl, page);
    const parsed = parseFrenchStreamSearch(html);
    const items = await enrichFrenchStreamCatalog(
      parsed.slice(0, FRENCH_STREAM_CATALOG_PAGE_SIZE),
    );
    return responseJson(200, {
      items,
      page,
      hasMore: searchHasMore(html, page, parsed.length),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertMovieUrl(requestUrl.searchParams.get("url") ?? "");
    const html = await fetchFrenchStreamHtml(target);
    const details = parseFrenchStreamDetails(html, target);
    if (details.mediaType === "series") {
      const episodeData = await fetchFrenchStreamEpisodeData(details.id, { baseUrl: ctx.baseUrl }).catch(() => null);
      const chapters = parseFrenchStreamSeriesChapters(episodeData, details.url);
      const availableAudioLanguages = frenchStreamAudioLanguagesFromEpisodeData(episodeData);
      const relatedItems = await fetchRelatedSeasons(details.serieTag, details.id);
      return responseJson(200, applyRecentChapterFields({
        ...details,
        chapters,
        totalEpisodes: chapters.length,
        availableAudioLanguages,
        audioLabel: frenchStreamAudioLabelFromLanguages(availableAudioLanguages, details.audioLabel),
        relatedItems,
      }, [...chapters].reverse()));
    }
    const api = await fetchFilmApi(details.id).catch(() => null);
    const availableAudioLanguages = frenchStreamAudioLanguagesFromPlayers(api?.players);
    const watchUrl = details.chapters[0]?.url;
    const audioLanguages = {};
    if (watchUrl && availableAudioLanguages.includes("VF")) audioLanguages.VF = watchUrl;
    if (watchUrl && availableAudioLanguages.includes("VOSTFR")) audioLanguages.VOSTFR = watchUrl;
    const chapters = details.chapters.length
      ? [attachFrenchStreamChapterAudioLanguages(details.chapters[0], audioLanguages)]
      : details.chapters;
    return responseJson(200, {
      ...details,
      chapters,
      availableAudioLanguages,
      audioLabel: frenchStreamAudioLabelFromLanguages(availableAudioLanguages, details.audioLabel),
      relatedItems: await fetchRelatedFrenchStreamMovies(details.title, details.id, ctx.baseUrl),
    });
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertChapterUrl(requestUrl.searchParams.get("url") ?? "");
    const language = requestUrl.searchParams.get("language")?.trim() || "";
    const seasonUrl = assertMovieUrl(target);
    const html = await fetchFrenchStreamHtml(seasonUrl);
    const details = parseFrenchStreamDetails(html, seasonUrl);
    if (details.mediaType === "series") {
      const episodeData = await fetchFrenchStreamEpisodeData(details.id, { baseUrl: ctx.baseUrl });
      const episode = episodeNumberFromUrl(target) || firstPlayableEpisode(episodeData);
      const players = episodeToPlayers(episodeData, episode);
      const meta = episodeBucket(episodeData?.info, episode) || {};
      const episodeTitle = String(meta.title || "").trim();
      const title = episodeTitle && !/^épisode\s+\d+$/i.test(episodeTitle)
        ? `${details.title} · ${episode} · ${episodeTitle}`
        : `${details.title} · ${episode}`;
      return responseJson(200, await enrichFrenchStreamPlayback({ players }, {
        ...details,
        title,
        url: target,
      }, language));
    }
    const api = await fetchFilmApi(details.id);
    return responseJson(200, await enrichFrenchStreamPlayback(api, details, language));
  }

  return responseJson(404, { error: "Route French Stream inconnue" });
}
