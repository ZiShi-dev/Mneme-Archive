import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { enrichSourcesWithStreams } from "../lib/embedResolvers.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, enrichCatalogItems } from "../lib/catalogChapters.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";

const BASE_URL = "https://anime-sama.to";
const BASE_HOST = new URL(BASE_URL).hostname;
const SOURCE_NAME = "Anime-Sama";
const SOURCE_ID = "animesama";
const CATALOG_PATH = "/catalogue/";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ALLOWED_HOSTS = new Set([
  BASE_HOST,
  "anime-sama.fr",
  "anime-sama.org",
  "www.anime-sama.to",
  "www.anime-sama.fr",
  "www.anime-sama.org",
]);

const IMAGE_HOSTS = new Set([
  "cdn.jsdelivr.net",
]);

const AUDIO_LABELS = {
  vostfr: "VOSTFR",
  vf: "VF",
  va: "VA",
  var: "VAR",
  vkr: "VKR",
  vcn: "VCN",
  vqc: "VQC",
  vf1: "VF1",
  vf2: "VF2",
};

export function normalizeAnimesamaUrl(rawUrl = "", { keepHost = false } = {}) {
  const decoded = decodeHtml(rawUrl);
  if (!decoded) return "";
  try {
    const url = new URL(decoded, BASE_URL);
    if (url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(host) && !IMAGE_HOSTS.has(host)) return "";
    if (!keepHost && !IMAGE_HOSTS.has(host)) url.hostname = BASE_HOST;
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function assertAnimesamaHost(rawUrl) {
  const normalized = normalizeAnimesamaUrl(rawUrl);
  if (!normalized) throw new Error("رابط Anime-Sama غير صالح");
  const url = new URL(normalized);
  if (!IMAGE_HOSTS.has(url.hostname.toLowerCase())) {
    url.hostname = BASE_HOST;
  }
  url.hash = "";
  return url.toString();
}

function assertCatalogueUrl(rawUrl) {
  const url = assertAnimesamaHost(rawUrl);
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  if (parts[0] !== "catalogue" || parts.length < 2) {
    throw new Error("رابط Anime-Sama غير صالح");
  }
  return url.endsWith("/") ? url : `${url}/`;
}

function slugFromUrl(url = "") {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  if (parts[0] !== "catalogue" || !parts[1]) return "";
  return parts[1];
}

function isSeasonUrl(url = "") {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  return parts[0] === "catalogue" && parts.length >= 4;
}

function audioLabelFromPath(url = "") {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const lang = parts[parts.length - 1]?.toLowerCase() || "";
  return AUDIO_LABELS[lang] || lang.toUpperCase();
}

function buildEpisodeUrl(seasonUrl, episodeNumber) {
  const base = assertCatalogueUrl(seasonUrl);
  const url = new URL(base);
  url.searchParams.set("ep", String(episodeNumber));
  return url.toString();
}

function parseEpisodeTarget(rawUrl = "") {
  const normalized = assertCatalogueUrl(rawUrl);
  const url = new URL(normalized);
  const episode = Math.max(1, Number(url.searchParams.get("ep")) || 1);
  url.searchParams.delete("ep");
  return {
    seasonUrl: withTrailingSlash(url.toString()),
    episode,
  };
}

const fetchAnimesamaHtml = createCachedHtmlFetcher({
  ttlMs: 3 * 60_000,
  timeoutMs: 40_000,
  headers: {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "fr-FR,fr;q=0.9,en;q=0.6",
    referer: `${BASE_URL}/`,
    "user-agent": BROWSER_UA,
  },
  getVariants: (url) => [url],
  buildError: (lastStatus) => `Anime-Sama a répondu ${lastStatus || "sans réponse"}`,
});

async function fetchAnimesamaText(url, { referer = `${BASE_URL}/` } = {}) {
  const response = await fetch(url, {
    headers: {
      accept: "*/*",
      referer,
      "user-agent": BROWSER_UA,
    },
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) throw new Error(`Anime-Sama a répondu ${response.status}`);
  return response.text();
}

async function fetchSearchHtml(query) {
  const body = new URLSearchParams({ query });
  const response = await fetch(`${BASE_URL}/template-php/defaut/fetch.php`, {
    method: "POST",
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: BASE_URL,
      referer: `${BASE_URL}/catalogue/`,
      "user-agent": BROWSER_UA,
    },
    body,
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) throw new Error(`Recherche Anime-Sama indisponible (${response.status})`);
  return response.text();
}

function assertAnimesamaImageUrl(rawUrl = "") {
  const decoded = decodeHtml(String(rawUrl).trim());
  if (!decoded) throw new Error("رابط الصورة غير مسموح");
  const url = new URL(decoded);
  if (url.protocol !== "https:") throw new Error("رابط الصورة غير مسموح");
  const host = url.hostname.toLowerCase();
  if (IMAGE_HOSTS.has(host)) return url.toString();
  if (ALLOWED_HOSTS.has(host) && url.pathname.startsWith("/img/")) return url.toString();
  throw new Error("رابط الصورة غير مسموح");
}

function parseCatalogCard(block = "") {
  const href = block.match(/<a[^>]*href="([^"]+)"/i)?.[1] || "";
  const url = normalizeAnimesamaUrl(href);
  const id = slugFromUrl(url);
  if (!url || !id || isSeasonUrl(url)) return null;
  const title = textOnly(block.match(/<h2[^>]*class="[^"]*card-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "");
  if (!title) return null;
  const altTitle = textOnly(block.match(/<p[^>]*class="[^"]*alternate-titles[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const cover = normalizeAnimesamaUrl(block.match(/<img[^>]*class="[^"]*card-image[^"]*"[^>]*src="([^"]+)"/i)?.[1] ?? "", { keepHost: true });
  const genres = [...block.matchAll(/<span class="genre-tag">([\s\S]*?)<\/span>/gi)]
    .map((match) => textOnly(match[1]))
    .filter(Boolean);
  return applyRecentChapterFields({
    id,
    title,
    altTitle,
    url,
    cover,
    summary: "",
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "anime",
    mediaTypeLabel: "أنمي",
    audioLabel: "VOSTFR",
    categories: genres,
  }, []);
}

export function parseAnimesamaCatalog(html = "") {
  const results = [];
  const seen = new Set();
  const starts = [...html.matchAll(/<div class="shrink-0 catalog-card card-base">/gi)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const item = parseCatalogCard(block);
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    results.push(item);
  });
  return results;
}

export function parseAnimesamaSearchResults(html = "") {
  const results = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a\b([^>]*)>[\s\S]*?<\/a>/gi)) {
    const attrs = match[1];
    if (!/asn-search-result/i.test(attrs)) continue;
    const block = match[0];
    const href = attrs.match(/href\s*=\s*"([^"]+)"/i)?.[1] || "";
    const url = normalizeAnimesamaUrl(href);
    const id = slugFromUrl(url);
    if (!url || !id || seen.has(id)) continue;
    const title = textOnly(block.match(/<h3[^>]*class="[^"]*asn-search-result-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? "");
    if (!title) continue;
    seen.add(id);
    const altTitle = textOnly(block.match(/<p[^>]*class="[^"]*asn-search-result-subtitle[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const cover = normalizeAnimesamaUrl(
      block.match(/<img[^>]*src="([^"]+)"/i)?.[1] ?? "",
      { keepHost: true },
    );
    results.push(applyRecentChapterFields({
      id,
      title,
      altTitle,
      url,
      cover,
      summary: "",
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType: "anime",
      mediaTypeLabel: "أنمي",
      audioLabel: "VOSTFR",
    }, []));
  }
  return results;
}

function withTrailingSlash(url = "") {
  return url.endsWith("/") ? url : `${url}/`;
}

function parseSeasonPanels(html = "", baseUrl = "") {
  const panels = [];
  const seen = new Set();
  const base = withTrailingSlash(assertCatalogueUrl(baseUrl));
  for (const match of html.matchAll(/panneauAnime\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/gi)) {
    const label = textOnly(match[1]);
    const relative = match[2].replace(/^\/+/, "");
    if (!relative || relative === "url" || /^nom$/i.test(label)) continue;
    const seasonUrl = withTrailingSlash(normalizeAnimesamaUrl(new URL(relative, base).toString()));
    if (!seasonUrl || seen.has(seasonUrl)) continue;
    seen.add(seasonUrl);
    panels.push({
      label,
      url: seasonUrl,
      audioLabel: audioLabelFromPath(seasonUrl),
    });
  }
  return panels;
}

function pickDefaultSeason(panels = []) {
  if (!panels.length) return null;
  return panels.find((entry) => /vostfr/i.test(entry.url))
    || panels.find((entry) => /\/vf\/?$/i.test(entry.url))
    || panels[0];
}

function episodesScriptUrl(html = "", seasonUrl = "") {
  const relative = html.match(/src=['"]([^'"]*episodes\.js[^'"]*)['"]/i)?.[1] || "";
  if (!relative) return "";
  return normalizeAnimesamaUrl(new URL(relative, withTrailingSlash(seasonUrl)).toString(), { keepHost: true });
}

export function parseAnimesamaEpisodesJs(source = "") {
  const players = [];
  for (const match of String(source).matchAll(/var\s+(eps\d+)\s*=\s*\[([\s\S]*?)\];/gi)) {
    const urls = [...match[2].matchAll(/'(https?:[^']+)'/gi)].map((entry) => decodeHtml(entry[1]));
    if (urls.length) {
      players.push({
        key: match[1],
        label: `Lecteur ${match[1].replace(/\D/g, "")}`,
        urls,
      });
    }
  }
  return players;
}

async function fetchSeasonPlayers(seasonUrl) {
  const html = await fetchAnimesamaHtml(seasonUrl);
  const scriptUrl = episodesScriptUrl(html, seasonUrl);
  if (!scriptUrl) return { html, players: [] };
  const script = await fetchAnimesamaText(scriptUrl, { referer: seasonUrl });
  return { html, players: parseAnimesamaEpisodesJs(script) };
}

function buildEpisodeChapters(seasonUrl, players = []) {
  const episodeCount = players[0]?.urls?.length || 0;
  const chapters = [];
  for (let episode = 1; episode <= episodeCount; episode += 1) {
    chapters.push({
      url: buildEpisodeUrl(seasonUrl, episode),
      name: String(episode),
      number: String(episode),
      date: "",
      locked: false,
    });
  }
  return chapters;
}

function parseAnimesamaTitle(html = "") {
  return textOnly(
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? html.match(/<h3[^>]*id="titreOeuvre"[^>]*>([\s\S]*?)<\/h3>/i)?.[1]
      ?? "",
  );
}

function parseSeasonLabel(html = "", seasonUrl = "") {
  return textOnly(html.match(/\$\("#avOeuvre"\)\.html\("([^"]+)"\)/i)?.[1] ?? "")
    || audioLabelFromPath(seasonUrl);
}

function parseAnimesamaCover(html = "", fallbackUrl = "") {
  const fromImg = normalizeAnimesamaUrl(html.match(/<img[^>]*id="imgOeuvre"[^>]*src="([^"]+)"/i)?.[1] ?? "", { keepHost: true });
  if (fromImg) return fromImg;
  const og = normalizeAnimesamaUrl(html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ?? "", { keepHost: true });
  if (og) return og;
  const slug = slugFromUrl(fallbackUrl);
  if (!slug) return "";
  return `https://cdn.jsdelivr.net/gh/Anime-Sama/IMG@img/contenu/thumb/${slug}.webp`;
}

function parseAnimesamaDetails(html, url, { panels = [], season = null, players = [] } = {}) {
  const normalizedUrl = assertCatalogueUrl(url);
  const title = parseAnimesamaTitle(html);
  const altTitle = textOnly(html.match(/<h2[^>]*id="titreAlter"[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "");
  const summary = textOnly(html.match(/<p[^>]*id="synopsisText"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const year = textOnly(html.match(/<span class="info-lbl">[\s\S]*?Année[\s\S]*?<\/span>[\s\S]*?<span class="info-val[^"]*">([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const cover = parseAnimesamaCover(html, normalizedUrl);
  const activeSeason = season || pickDefaultSeason(panels);
  const seasonUrl = activeSeason?.url || "";
  const chapters = seasonUrl ? buildEpisodeChapters(seasonUrl, players) : [];
  const relatedItems = panels
    .filter((entry) => entry.url !== seasonUrl)
    .map((entry) => ({
      id: `${slugFromUrl(normalizedUrl)}:${entry.label}`,
      title: `${title} · ${entry.label}`,
      altTitle: entry.audioLabel,
      url: entry.url,
      cover,
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType: "anime",
      audioLabel: entry.audioLabel,
    }));

  return enrichSourceDetails({
    id: slugFromUrl(normalizedUrl),
    title: title || "Anime",
    altTitle,
    url: normalizedUrl,
    cover,
    summary,
    year,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "anime",
    mediaTypeLabel: "أنمي",
    audioLabel: activeSeason?.audioLabel || "VOSTFR",
    availableAudioLanguages: [...new Set(panels.map((entry) => entry.audioLabel).filter(Boolean))],
    relatedItems,
    chapters,
    totalEpisodes: chapters.length,
    activeSeasonLabel: activeSeason?.label || "",
    activeSeasonUrl: seasonUrl,
  });
}

async function enrichAnimesamaPlayback({ seasonUrl, episode, players = [], title = "" }) {
  const index = Math.max(0, episode - 1);
  const sources = players
    .map((player) => {
      const embedUrl = player.urls[index] || "";
      if (!embedUrl) return null;
      return {
        label: player.label,
        url: embedUrl,
      };
    })
    .filter(Boolean);

  const enriched = await enrichSourcesWithStreams(sources, seasonUrl);
  const playable = enriched.find((entry) => entry.streamUrl);
  if (playable) {
    return {
      title,
      url: buildEpisodeUrl(seasonUrl, episode),
      sources: enriched,
      videoUrl: playable.streamUrl,
      streamUrl: playable.streamUrl,
      streamReferer: playable.streamReferer || seasonUrl,
      playbackMode: "hls",
      activeSource: playable.label,
      embedUrl: "",
    };
  }

  const embedUrl = enriched[0]?.url || "";
  return {
    title,
    url: buildEpisodeUrl(seasonUrl, episode),
    sources: enriched,
    embedUrl,
    playbackMode: embedUrl ? "embed" : undefined,
    streamUrl: "",
    videoUrl: "",
  };
}

function catalogHasMore(html, page) {
  const maxPage = Number([...html.matchAll(/catalogue\/\?page=(\d+)/gi)].map((match) => match[1]).sort((a, b) => Number(b) - Number(a))[0] || 0);
  if (maxPage) return page < maxPage;
  return parseAnimesamaCatalog(html).length > 0;
}

async function fetchRecentEpisodesForItem(item) {
  const html = await fetchAnimesamaHtml(item.url);
  const panels = parseSeasonPanels(html, item.url);
  const season = pickDefaultSeason(panels);
  if (!season) return [];
  const { players } = await fetchSeasonPlayers(season.url);
  const chapters = buildEpisodeChapters(season.url, players);
  item.chapterCount = chapters.length;
  return [...chapters].reverse();
}

export async function enrichAnimesamaCatalogItems(items, { concurrency = 6 } = {}) {
  return enrichCatalogItems(items, {
    concurrency,
    enrichItem: fetchRecentEpisodesForItem,
  });
}

export async function handleAnimesamaRequest(requestUrl) {
  if (requestUrl.pathname.endsWith("/image")) {
    const target = assertAnimesamaImageUrl(requestUrl.searchParams.get("url") ?? "");
    return fetchProxiedImage(target, `${BASE_URL}/`, SOURCE_NAME);
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    return responseJson(200, {
      kinds: [{ slug: "all", name: "الكل", filterPath: "/all/" }],
      categories: [],
      tags: [],
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const catalogUrl = page <= 1 ? `${BASE_URL}${CATALOG_PATH}` : `${BASE_URL}${CATALOG_PATH}?page=${page}`;
    const html = await fetchAnimesamaHtml(catalogUrl);
    const items = parseAnimesamaCatalog(html);
    await enrichAnimesamaCatalogItems(items, { concurrency: 6 });
    return responseJson(200, {
      items,
      page,
      hasMore: catalogHasMore(html, page),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const html = await fetchSearchHtml(query);
    const items = parseAnimesamaSearchResults(html);
    await enrichAnimesamaCatalogItems(items, { concurrency: 4 });
    return responseJson(200, { items, page: 1, hasMore: false });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertCatalogueUrl(requestUrl.searchParams.get("url") ?? "");
    if (isSeasonUrl(target)) {
      const { players } = await fetchSeasonPlayers(target);
      const html = await fetchAnimesamaHtml(target);
      const animeTitle = parseAnimesamaTitle(html);
      const seasonLabel = parseSeasonLabel(html, target);
      const details = parseAnimesamaDetails(html, target, {
        season: { label: seasonLabel, url: target, audioLabel: audioLabelFromPath(target) },
        players,
      });
      return responseJson(200, applyRecentChapterFields({
        ...details,
        title: animeTitle ? `${animeTitle} · ${seasonLabel}` : details.title,
        url: target,
      }, [...details.chapters].reverse()));
    }

    const html = await fetchAnimesamaHtml(target);
    const panels = parseSeasonPanels(html, target);
    const season = pickDefaultSeason(panels);
    const players = season ? (await fetchSeasonPlayers(season.url)).players : [];
    const details = parseAnimesamaDetails(html, target, { panels, season, players });
    return responseJson(200, applyRecentChapterFields(details, [...details.chapters].reverse()));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = requestUrl.searchParams.get("url") ?? "";
    const { seasonUrl, episode } = parseEpisodeTarget(target);
    const { players } = await fetchSeasonPlayers(seasonUrl);
    const html = await fetchAnimesamaHtml(seasonUrl);
    const animeTitle = parseAnimesamaTitle(html);
    const seasonLabel = parseSeasonLabel(html, seasonUrl);
    const title = animeTitle ? `${animeTitle} · ${seasonLabel} · ${episode}` : `Épisode ${episode}`;
    return responseJson(200, await enrichAnimesamaPlayback({
      seasonUrl,
      episode,
      players,
      title,
    }));
  }

  return responseJson(404, { error: "Route Anime-Sama inconnue" });
}
