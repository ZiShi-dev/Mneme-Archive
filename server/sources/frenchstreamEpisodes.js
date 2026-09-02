import { fetchWithRetries } from "../lib/httpUtils.js";
import { recentChaptersFromList } from "../lib/catalogChapters.js";
import {
  BROWSER_UA,
  DEFAULT_BASE_URL,
  episodeUrl,
  newsIdFromUrl,
} from "./frenchstreamCore.js";

const FRENCH_STREAM_EPISODE_DATA_CACHE_TTL_MS = 5 * 60_000;
const FRENCH_STREAM_EPISODE_NEGATIVE_CACHE_TTL_MS = 2 * 60_000;
const frenchStreamEpisodeDataCache = new Map();
const frenchStreamEpisodePathHint = new Map();

export function hostMapHasUrl(hosts) {
  if (!hosts || typeof hosts !== "object") return false;
  return Object.values(hosts).some((value) => String(value || "").trim());
}

export function episodeBucket(source, number) {
  if (!source || typeof source !== "object") return null;
  return source[String(number)] || source[number] || null;
}

function buildFrenchStreamEpisodePaths(newsId, baseUrl = DEFAULT_BASE_URL) {
  return [
    `${baseUrl}/static/series/${newsId}.js`,
    `${baseUrl}/assets/poster_${newsId}.json`,
    `${baseUrl}/data/eps_${newsId}.txt`,
    `${baseUrl}/ep-data.php?id=${encodeURIComponent(newsId)}&format=js`,
  ];
}

function readFrenchStreamEpisodeDataCache(newsId) {
  const cached = frenchStreamEpisodeDataCache.get(String(newsId || ""));
  if (!cached) return null;
  const ttl = cached.data == null
    ? FRENCH_STREAM_EPISODE_NEGATIVE_CACHE_TTL_MS
    : FRENCH_STREAM_EPISODE_DATA_CACHE_TTL_MS;
  if (Date.now() - cached.at >= ttl) return null;
  return cached;
}

export function getFrenchStreamEpisodeDataCache(newsId) {
  return readFrenchStreamEpisodeDataCache(newsId);
}

export function rememberFrenchStreamEpisodeData(newsId, data, pathIndex = -1) {
  const key = String(newsId || "");
  frenchStreamEpisodeDataCache.set(key, { at: Date.now(), data: data ?? null });
  if (pathIndex >= 0) frenchStreamEpisodePathHint.set(key, pathIndex);
}

export function clearFrenchStreamEpisodeCaches() {
  frenchStreamEpisodeDataCache.clear();
  frenchStreamEpisodePathHint.clear();
}

function parseEpisodeJson(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { /* maybe JS-wrapped */ }
  const match = trimmed.match(/\{[\s\S]*\}\s*$/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

export async function fetchFrenchStreamEpisodeData(newsId, { baseUrl = DEFAULT_BASE_URL, fast = false } = {}) {
  const cached = readFrenchStreamEpisodeDataCache(newsId);
  if (cached) {
    if (cached.data == null) throw new Error("تعذر تحميل حلقات المسلسل");
    return cached.data;
  }

  const paths = buildFrenchStreamEpisodePaths(newsId, baseUrl);
  const hint = frenchStreamEpisodePathHint.get(String(newsId || "")) ?? 0;
  const ordered = [...paths.slice(hint), ...paths.slice(0, hint)];
  const timeoutMs = fast ? 12_000 : 25_000;
  const retries = fast ? 0 : 1;
  let lastError = null;

  for (let index = 0; index < ordered.length; index += 1) {
    const path = ordered[index];
    try {
      const response = await fetchWithRetries(path, {
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          referer: `${baseUrl}/index.php?newsid=${newsId}`,
          "user-agent": BROWSER_UA,
        },
        timeoutMs,
      }, retries);
      if (!response.ok) {
        lastError = new Error(`French Stream a répondu ${response.status}`);
        continue;
      }
      const parsed = parseEpisodeJson(await response.text());
      if (parsed && (parsed.vf || parsed.vostfr || parsed.vo)) {
        rememberFrenchStreamEpisodeData(newsId, parsed, (hint + index) % paths.length);
        return parsed;
      }
    } catch (error) {
      lastError = error;
    }
  }

  rememberFrenchStreamEpisodeData(newsId, null);
  throw lastError || new Error("تعذر تحميل حلقات المسلسل");
}

export function parseFrenchStreamSeriesChapters(episodeData, seasonUrl) {
  const vf = episodeData?.vf || {};
  const vostfr = episodeData?.vostfr || {};
  const vo = episodeData?.vo || {};
  const info = episodeData?.info || {};
  const numbers = [...new Set([
    ...Object.keys(vf),
    ...Object.keys(vostfr),
    ...Object.keys(vo),
  ])]
    .map(Number)
    .filter((number) => Number.isFinite(number) && number > 0)
    .sort((left, right) => left - right);
  return numbers.flatMap((number) => {
    const playable = hostMapHasUrl(episodeBucket(vf, number))
      || hostMapHasUrl(episodeBucket(vostfr, number))
      || hostMapHasUrl(episodeBucket(vo, number));
    if (!playable) return [];
    const meta = episodeBucket(info, number) || {};
    const episodeTitle = String(meta.title || "").trim();
    const name = episodeTitle && !/^épisode\s+\d+$/i.test(episodeTitle)
      ? `${number} · ${episodeTitle}`
      : String(number);
    const watchUrl = episodeUrl(seasonUrl, number);
    const audioLanguages = {};
    if (hostMapHasUrl(episodeBucket(vf, number))) audioLanguages.VF = watchUrl;
    if (hostMapHasUrl(episodeBucket(vostfr, number))) audioLanguages.VOSTFR = watchUrl;
    return [{
      url: watchUrl,
      name,
      number: String(number),
      date: "",
      locked: false,
      audioLanguages,
    }];
  });
}

export function frenchStreamAudioLanguagesFromEpisodeData(episodeData = {}) {
  const vf = episodeData?.vf || {};
  const vostfr = episodeData?.vostfr || {};
  const languages = [];
  const hasVf = Object.keys(vf).some((number) => hostMapHasUrl(episodeBucket(vf, number)));
  const hasVostfr = Object.keys(vostfr).some((number) => hostMapHasUrl(episodeBucket(vostfr, number)));
  if (hasVf) languages.push("VF");
  if (hasVostfr) languages.push("VOSTFR");
  return languages;
}

export function episodeToPlayers(episodeData, episodeNumber) {
  const players = {};
  const assign = (bucket, langKey) => {
    const hosts = episodeBucket(bucket, episodeNumber);
    if (!hosts || typeof hosts !== "object") return;
    for (const [host, rawUrl] of Object.entries(hosts)) {
      const url = String(rawUrl || "").trim();
      if (!url) continue;
      if (!players[host]) players[host] = {};
      players[host][langKey] = url;
    }
  };
  assign(episodeData?.vf, "default");
  assign(episodeData?.vostfr, "vostfr");
  assign(episodeData?.vo, "vo");
  return players;
}

export function firstPlayableEpisode(episodeData) {
  const chapters = parseFrenchStreamSeriesChapters(episodeData, `${DEFAULT_BASE_URL}/index.php?newsid=1`);
  return chapters[0]?.number || "";
}

export function recentChaptersFromEpisodeData(episodeData, seasonUrl) {
  if (!episodeData) return [];
  return recentChaptersFromList(parseFrenchStreamSeriesChapters(episodeData, seasonUrl));
}

export function frenchStreamSeriesNeedsEnrich(item) {
  if (item?.mediaType !== "series" || !item.id) return false;
  const latest = Number(item.latestChapter);
  if (!Number.isFinite(latest) || latest <= 0) return true;
  const recent = item.recentChapters || [];
  if (recent.length < 2) return true;
  return !recent.every((chapter, index) => {
    const number = Number(chapter.number);
    const expected = latest - index;
    return Number.isFinite(number)
      && number === expected
      && /[?&]ep=\d+/i.test(String(chapter.url || ""));
  });
}
