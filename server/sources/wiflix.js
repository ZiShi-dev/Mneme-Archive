import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/responseJson.js";
import { applyRecentChapterFields } from "../lib/catalogChapters.js";
import {
  assertProxiedEmbedUrl,
  assertProxiedStreamUrl,
  enrichSourcesWithStreams,
  fetchEmbedHtml,
  wrapProxiedEmbedHtml,
} from "../lib/embedResolvers.js";
import { fetchProxiedHlsResource } from "../lib/hlsProxy.js";
import { videoHostRank } from "../lib/videoHosts.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";
import {
  assertChapterUrl,
  assertFilterPath,
  assertWatchUrl,
  assertWiflixImageUrl,
  assertWiflixStreamReferer,
  BROWSER_UA,
  DEFAULT_BASE_URL,
  episodeNumberFromUrl,
  MIXED_PATH,
  normalizeWiflixAudioLabel,
  SOURCE_ID,
  SOURCE_NAME,
  toggleEpisodeLanguage,
} from "./wiflixCore.js";
import {
  clearWiflixCatalogCaches,
  fetchRelatedWiflixItems,
  fetchWiflixCatalogPage,
  fetchWiflixFilters,
  isRelatedWiflixTitle,
  parseWiflixCatalog,
  parseWiflixFilters,
  pickRelatedWiflixItems,
  rankWiflixSearch,
  relatedWiflixSearchQuery,
  searchWiflix,
  WIFLIX_CATALOG_PAGE_SIZE,
  wiflixSearchScore,
  wiflixSearchVariants,
} from "./wiflixCatalog.js";
import {
  parseWiflixDetails,
  parseWiflixEpisodes,
} from "./wiflixEpisodes.js";

export {
  WIFLIX_CATALOG_PAGE_SIZE,
  fetchWiflixCatalogPage,
  isRelatedWiflixTitle,
  parseWiflixCatalog,
  parseWiflixFilters,
  pickRelatedWiflixItems,
  rankWiflixSearch,
  relatedWiflixSearchQuery,
  wiflixSearchScore,
  wiflixSearchVariants,
} from "./wiflixCatalog.js";
export {
  parseWiflixDetails,
  parseWiflixEpisodes,
} from "./wiflixEpisodes.js";
export {
  assertChapterUrl,
  assertFilterPath,
  assertWatchUrl,
  assertWiflixImageUrl,
  assertWiflixStreamReferer,
  buildCatalogUrl,
  buildSearchUrl,
  catalogHasMore,
  episodeLanguageFromUrl,
  episodeNumberFromUrl,
  normalizeWiflixAudioLabel,
  normalizeWiflixUrl,
  watchSlugFromUrl,
} from "./wiflixCore.js";

const PLAYER_HOST_ORDER = [
  /vidzy\./i,
  /fsvid\./i,
  /filemoon\./i,
  /uqload\./i,
  /96ar\.|filmoon|netu|multiup/i,
  /voe|sandratableother|diananatureforeign|flixeo/i,
  /dood/i,
];
const PLAYER_LABELS = [
  { pattern: /uqload/i, label: "Uqload" },
  { pattern: /vidzy/i, label: "Vidzy" },
  { pattern: /filemoon/i, label: "Filemoon" },
  { pattern: /96ar|filmoon|netu|multiup/i, label: "Filmoon" },
  { pattern: /voe|sandratableother|diananatureforeign/i, label: "VOE" },
  { pattern: /dood/i, label: "Dood" },
];
const LANG_RANK = [
  /^(TRUE)?FRENCH$|^VF[QF]?$/i,
  /^VF\+VOSTFR$/i,
  /VOST/i,
];

function createWiflixFetcher(baseUrl = DEFAULT_BASE_URL) {
  const hostCtx = createHostContext(baseUrl);
  return createCachedHtmlFetcher({
    ttlMs: 3 * 60_000,
    timeoutMs: 40_000,
    retries: 2,
    skipFlareSolverrFallback: true,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.6",
      referer: `${baseUrl}/`,
      "user-agent": BROWSER_UA,
    },
    getVariants: (url) => {
      try {
        const parsed = new URL(url);
        const alt = new URL(url);
        alt.hostname = parsed.hostname === hostCtx.apex ? hostCtx.hostname : hostCtx.apex;
        return alt.toString() === url ? [url] : [url, alt.toString()];
      } catch {
        return [url];
      }
    },
    buildError: (lastStatus) => `Wiflix a répondu ${lastStatus || "sans réponse"}`,
  });
}

function hostLabelFromUrl(url = "", fallback = "") {
  const text = String(fallback || "").trim();
  if (text) {
    const mapped = PLAYER_LABELS.find((entry) => entry.pattern.test(text));
    if (mapped) return mapped.label;
    const pretty = text.replace(/[_-]+/g, " ").trim();
    if (pretty) return pretty.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  const mapped = PLAYER_LABELS.find((entry) => entry.pattern.test(url));
  if (mapped) return mapped.label;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "سيرفر";
  }
}

function isHttpUrl(value = "") {
  return /^https:\/\//i.test(String(value || "").trim());
}

function languageRank(label = "") {
  const text = String(label || "");
  const index = LANG_RANK.findIndex((pattern) => pattern.test(text.replace(/\s+/g, "")));
  return index === -1 ? LANG_RANK.length : index;
}

function hostRank(url = "") {
  return videoHostRank(url, PLAYER_HOST_ORDER);
}

function extractWiflixActiveIframe(html = "") {
  return decodeHtml(
    html.match(/<iframe[^>]+id=(['"])x_player_wfx\1[^>]*\bsrc=(['"])([^'"]+)\2/i)?.[3]
    || html.match(/<iframe[^>]*\bsrc=(['"])([^'"]+)\1[^>]*\bid=(['"])x_player_wfx\3/i)?.[2]
    || "",
  );
}

function sortWiflixPlayers(sources = [], preferredUrl = "") {
  return [...sources].sort((left, right) => {
    if (preferredUrl) {
      if (left.url === preferredUrl) return -1;
      if (right.url === preferredUrl) return 1;
    }
    return languageRank(left.version || left.audioLabel) - languageRank(right.version || right.audioLabel)
      || hostRank(left.url) - hostRank(right.url);
  });
}

function pushPlayer(sources, seen, url, hostLabel, version) {
  const target = String(url || "").trim();
  if (!isHttpUrl(target) || seen.has(target)) return;
  seen.add(target);
  const audioLabel = normalizeWiflixAudioLabel(version);
  const host = hostLabelFromUrl(target, hostLabel);
  sources.push({
    label: audioLabel && audioLabel !== "VF" ? `${host} ${audioLabel}` : host,
    url: target,
    audioLabel,
    version: version || audioLabel,
  });
}

export function parseWiflixPlayers(html = "") {
  const sources = [];
  const seen = new Set();
  const items = [...html.matchAll(/<a\b([^>]*server-item[^>]*)>/gi)];
  items.forEach((match, index) => {
    const block = html.slice(match.index, items[index + 1]?.index ?? html.length);
    const defaultSrc = decodeHtml(match[1].match(/data-src=(['"])([^'"]*)\1/i)?.[2] ?? "");
    const hostLabel = textOnly(block.match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const versions = [...block.matchAll(/<div[^>]*class="[^"]*version-option[^"]*"[^>]*>/gi)];
    if (versions.length) {
      for (const versionTag of versions) {
        const url = decodeHtml(versionTag[0].match(/data-url=(['"])([^'"]*)\1/i)?.[2] ?? "");
        const version = decodeHtml(versionTag[0].match(/data-version=(['"])([^'"]*)\1/i)?.[2] ?? "");
        pushPlayer(sources, seen, url, hostLabel, version);
      }
      return;
    }
    pushPlayer(sources, seen, defaultSrc, hostLabel, "");
  });
  const activeIframe = extractWiflixActiveIframe(html);
  if (activeIframe) {
    pushPlayer(sources, seen, activeIframe, "", "");
  } else {
    const iframe = decodeHtml(html.match(/<iframe[^>]+src=(['"])([^'"]+)\1/i)?.[2] ?? "");
    pushPlayer(sources, seen, iframe, "", "");
  }
  return sortWiflixPlayers(sources, activeIframe);
}

export function parseWiflixPlayback(html, details) {
  const activeIframe = extractWiflixActiveIframe(html);
  const sources = parseWiflixPlayers(html).map(({ label, url }) => ({ label, url }));
  const embedUrl = activeIframe || sources[0]?.url || "";
  if (!embedUrl) throw new Error("تعذر استخراج مشغل الفيلم");
  return {
    title: details.title,
    url: details.url,
    kind: "video",
    embedUrl,
    playerUrl: details.url,
    sources,
    playbackMode: "embed",
  };
}

function buildWiflixStreamProxyPath(targetUrl, referer = "") {
  const params = new URLSearchParams({ url: targetUrl });
  if (referer) params.set("referer", referer);
  return `/api/sources/${SOURCE_ID}/stream?${params}`;
}

async function enrichWiflixPlayback(html, details) {
  let playback;
  try {
    playback = parseWiflixPlayback(html, details);
  } catch {
    return {
      title: details.title,
      url: details.url,
      kind: "video",
      embedUrl: "",
      playerUrl: details.url,
      sources: [],
      playbackMode: "embed",
    };
  }
  const sources = await enrichSourcesWithStreams(playback.sources, details.url || playback.url);
  const normalizedSources = sources.map((source) => {
    if (/uqload\./i.test(source.url || "") || source.embedFallback) {
      const { streamUrl, streamReferer, streamType, embedFallback, ...rest } = source;
      return rest;
    }
    return source;
  });
  const playable = normalizedSources.find((entry) => entry.streamUrl);
  return {
    ...playback,
    sources: normalizedSources,
    streamUrl: playable?.streamUrl || "",
    videoUrl: playable?.streamUrl || "",
    streamReferer: playable?.streamReferer || "",
    playbackMode: playable ? "hls" : "embed",
    embedUrl: playable ? "" : (normalizedSources[0]?.url || playback.embedUrl),
  };
}

async function serveWiflixEmbedPage(requestUrl, ctx) {
  const target = assertProxiedEmbedUrl(requestUrl.searchParams.get("url") ?? "");
  const referer = assertWiflixStreamReferer(requestUrl.searchParams.get("referer") ?? `${ctx.baseUrl}/`, ctx);
  const html = wrapProxiedEmbedHtml(await fetchEmbedHtml(target, referer), target);
  if (!html.trim()) {
    return responseJson(502, { error: "تعذر تحميل المشغل المضمن" });
  }
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, max-age=60",
    },
  });
}

async function fetchPlayableChapter(fetchWiflixHtml, target, ctx) {
  let html = await fetchWiflixHtml(target);
  if (parseWiflixPlayers(html).length) return { html, url: target };
  const alternate = toggleEpisodeLanguage(target, ctx);
  if (!alternate || alternate === target) return { html, url: target };
  html = await fetchWiflixHtml(alternate);
  return { html, url: alternate };
}

export async function handleWiflixRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: SOURCE_NAME });
  const fetchWiflixHtml = createWiflixFetcher(ctx.baseUrl);

  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(assertWiflixImageUrl(requestUrl.searchParams.get("url") ?? "", ctx), `${ctx.baseUrl}/`, SOURCE_NAME);
  }

  if (requestUrl.pathname.endsWith("/stream")) {
    const target = assertProxiedStreamUrl(requestUrl.searchParams.get("url") ?? "");
    const referer = assertWiflixStreamReferer(requestUrl.searchParams.get("referer") ?? `${ctx.baseUrl}/`, ctx);
    return fetchProxiedHlsResource({
      target,
      referer,
      label: SOURCE_NAME,
      buildProxyUrl: (entry) => buildWiflixStreamProxyPath(entry, referer),
    });
  }

  if (requestUrl.pathname.endsWith("/embed")) {
    return serveWiflixEmbedPage(requestUrl, ctx);
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    return responseJson(200, await fetchWiflixFilters(fetchWiflixHtml, ctx.baseUrl));
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 2000);
    const filterPath = assertFilterPath(requestUrl.searchParams.get("filterPath")?.trim() || MIXED_PATH);
    const payload = await fetchWiflixCatalogPage(ctx, fetchWiflixHtml, { page, filterPath });
    return responseJson(200, payload);
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 2000);
    const filterPath = assertFilterPath(requestUrl.searchParams.get("filterPath")?.trim() || MIXED_PATH);
    if (filterPath !== MIXED_PATH) {
      const payload = await fetchWiflixCatalogPage(ctx, fetchWiflixHtml, { page, filterPath });
      const needle = query.toLocaleLowerCase("fr");
      return responseJson(200, {
        items: payload.items.filter((item) => (
          `${item.title || ""} ${item.altTitle || ""}`.toLocaleLowerCase("fr").includes(needle)
        )),
        page,
        hasMore: payload.hasMore,
      });
    }
    const result = await searchWiflix(fetchWiflixHtml, query, page, ctx.baseUrl);
    return responseJson(200, {
      items: result.items,
      page,
      hasMore: result.hasMore,
    });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertWatchUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    const html = await fetchWiflixHtml(target);
    const details = parseWiflixDetails(html, target, ctx);
    const chapters = details.mediaType === "series" ? parseWiflixEpisodes(html, details.url, ctx) : details.chapters;
    return responseJson(200, applyRecentChapterFields({
      ...details,
      chapters,
      totalEpisodes: chapters.length,
      relatedItems: await fetchRelatedWiflixItems(fetchWiflixHtml, details.title, details.id, details.mediaType, ctx.baseUrl),
    }, details.mediaType === "series" ? [...chapters].reverse() : chapters));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    let target = assertChapterUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    let html = await fetchWiflixHtml(target);
    const details = parseWiflixDetails(html, target, ctx);
    if (details.mediaType === "series" && !episodeNumberFromUrl(target, ctx) && details.chapters.length) {
      target = details.chapters[details.chapters.length - 1].url;
      html = await fetchWiflixHtml(target);
    }
    const playable = await fetchPlayableChapter(fetchWiflixHtml, target, ctx);
    const episode = episodeNumberFromUrl(playable.url, ctx);
    const title = details.mediaType === "series" && episode
      ? `${details.title} · ${episode}`
      : details.title;
    return responseJson(200, await enrichWiflixPlayback(playable.html, {
      ...details,
      title,
      url: playable.url,
    }));
  }

  return responseJson(404, { error: "Route Wiflix inconnue" });
}

export { clearWiflixCatalogCaches };