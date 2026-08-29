import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields } from "../lib/catalogChapters.js";
import { mergeCatalogByRecency } from "../lib/catalogMerge.js";
import {
  assertProxiedStreamUrl,
  enrichSourcesWithStreams,
} from "../lib/embedResolvers.js";
import { fetchProxiedHlsResource } from "../lib/hlsProxy.js";
import { videoHostRank } from "../lib/videoHosts.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";

const DEFAULT_BASE_URL = "https://www.wiflix.tv";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
const SOURCE_NAME = "Wiflix";
const SOURCE_ID = "wiflix";
const MOVIES_PATH = "/film-en-streaming/";
const SERIES_PATH = "/serie-en-streaming/";
const MIXED_PATH = "/all/";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const IMAGE_HOSTS = new Set([DEFAULT_CTX.apex, DEFAULT_CTX.hostname, `www.${DEFAULT_CTX.apex}`]);
const PLAYER_HOST_ORDER = [
  /vidzy\./i,
  /fsvid\./i,
  /filemoon\./i,
  /uqload\./i,
  /96ar\.|filmoon|netu/i,
  /voe|sandratableother|diananatureforeign/i,
  /dood/i,
];
const PLAYER_LABELS = [
  { pattern: /uqload/i, label: "Uqload" },
  { pattern: /vidzy/i, label: "Vidzy" },
  { pattern: /filemoon/i, label: "Filemoon" },
  { pattern: /96ar|filmoon|netu/i, label: "Filmoon" },
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

export function assertWiflixStreamReferer(rawUrl = "", ctx = DEFAULT_CTX) {
  const decoded = decodeHtml(String(rawUrl || "").trim());
  if (!decoded) throw new Error("مرجع البث غير صالح");
  let url;
  try {
    url = new URL(decoded, ctx.baseUrl);
  } catch {
    throw new Error("مرجع البث غير صالح");
  }
  if (url.protocol !== "https:" || !isAllowedHost(url.hostname, ctx)) {
    throw new Error("مرجع البث غير صالح");
  }
  url.hash = "";
  return url.toString();
}

function isAllowedHost(hostname = "", ctx = DEFAULT_CTX) {
  return ctx.allowedHosts.has(String(hostname).toLowerCase());
}

export function normalizeWiflixUrl(rawUrl = "", ctx = DEFAULT_CTX) {
  const decoded = decodeHtml(rawUrl);
  if (!decoded) return "";
  try {
    const url = new URL(decoded, ctx.baseUrl);
    if (url.protocol !== "https:" || !isAllowedHost(url.hostname, ctx)) return "";
    url.hostname = ctx.hostname;
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return "";
  }
}

function assertWiflixHost(rawUrl) {
  const normalized = normalizeWiflixUrl(rawUrl);
  if (!normalized) throw new Error("المصدر غير مسموح");
  return new URL(normalized);
}

export function watchSlugFromUrl(rawUrl = "") {
  try {
    const url = new URL(normalizeWiflixUrl(rawUrl) || String(rawUrl || ""), DEFAULT_BASE_URL);
    return url.pathname.match(/^\/watch\/([a-z0-9-]+)$/i)?.[1] || "";
  } catch {
    return "";
  }
}

export function assertWatchUrl(rawUrl) {
  const url = assertWiflixHost(rawUrl);
  const slug = watchSlugFromUrl(url.toString());
  if (!slug) throw new Error("رابط Wiflix غير صالح");
  return `${DEFAULT_BASE_URL}/watch/${slug}`;
}

export function episodeNumberFromUrl(rawUrl = "") {
  try {
    const url = new URL(String(rawUrl || ""), DEFAULT_BASE_URL);
    const episode = url.searchParams.get("episode");
    return /^\d+$/.test(episode || "") ? episode : "";
  } catch {
    return "";
  }
}

export function episodeLanguageFromUrl(rawUrl = "") {
  try {
    const url = new URL(String(rawUrl || ""), DEFAULT_BASE_URL);
    const language = String(url.searchParams.get("language") || "").toUpperCase();
    if (language === "VOSTFR") return "VOSTFR";
    if (language === "VF") return "VF";
    return "";
  } catch {
    return "";
  }
}

export function assertChapterUrl(rawUrl) {
  const canonical = assertWatchUrl(rawUrl);
  const episode = episodeNumberFromUrl(rawUrl);
  if (!episode) return canonical;
  const language = episodeLanguageFromUrl(rawUrl) === "VOSTFR" ? "VOSTFR" : "VF";
  return `${canonical}?language=${language}&episode=${episode}`;
}

function episodeUrl(seasonUrl, number, language = "VF") {
  const lang = String(language).toUpperCase() === "VOSTFR" ? "VOSTFR" : "VF";
  return `${assertWatchUrl(seasonUrl)}?language=${lang}&episode=${Number(number)}`;
}

export function assertWiflixImageUrl(rawUrl, ctx = DEFAULT_CTX) {
  const decoded = decodeHtml(rawUrl);
  let url;
  try {
    url = new URL(decoded, ctx.baseUrl);
  } catch {
    throw new Error("رابط الصورة غير مسموح");
  }
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("رابط الصورة غير مسموح");
  }
  if (!/^\/(?:poster|static)\//i.test(url.pathname)) {
    throw new Error("رابط الصورة غير مسموح");
  }
  url.hostname = ctx.hostname;
  url.hash = "";
  return url.toString();
}

export function assertFilterPath(rawPath = MIXED_PATH) {
  const path = String(rawPath || MIXED_PATH).trim();
  if (!path.startsWith("/") || path.includes("..") || path.includes("://")) {
    throw new Error("مسار فلتر Wiflix غير صالح");
  }
  const normalized = path.endsWith("/") ? path : `${path}/`;
  if (normalized === MIXED_PATH) return MIXED_PATH;
  if (normalized === MOVIES_PATH || normalized === SERIES_PATH) return normalized;
  if (/^\/genre\/[a-z0-9&%_.-]+\/$/i.test(normalized)) return normalized;
  if (/^\/annee\/\d{4}\/$/i.test(normalized)) return normalized;
  throw new Error("مسار فلتر Wiflix غير صالح");
}

function watchEntry(url, label = "1") {
  return {
    url,
    name: String(label || "1"),
    number: String(label || "1"),
    date: "",
    locked: false,
  };
}

function absoluteMediaUrl(raw = "", ctx = DEFAULT_CTX) {
  const decoded = decodeHtml(raw);
  if (!decoded) return "";
  try {
    const url = new URL(decoded, ctx.baseUrl);
    if (url.protocol !== "https:" || !isAllowedHost(url.hostname, ctx)) return "";
    url.hostname = ctx.hostname;
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function normalizeWiflixAudioLabel(raw = "") {
  const text = String(raw || "").toUpperCase().replace(/\s+/g, "");
  if (!text) return "";
  const hasVost = /VOST/.test(text);
  const hasVf = /VF/.test(text);
  const hasFrenchLabel = /^(TRUE)?FRENCH$/.test(text);
  if (hasVf && hasVost) return "VF+VOSTFR";
  if (hasVost) return "VOSTFR";
  if (hasVf || hasFrenchLabel) return "VF";
  if (text === "VO" || /(?:^|\+)VO(?:\+|$)/.test(text)) return "VO";
  return "";
}

function isSeriesCard(block = "", title = "") {
  return /block-sai|block-ep/i.test(block) || /saison\s+\d+/i.test(title);
}

function parseLatestEpisode(block = "") {
  const text = textOnly(block.match(/<div class="block-ep">([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function seriesCatalogChapters(seasonUrl, latestEpisode) {
  const latest = Number(latestEpisode) > 0 ? Number(latestEpisode) : 1;
  const chapters = [watchEntry(episodeUrl(seasonUrl, latest), String(latest))];
  if (latest > 1) chapters.push(watchEntry(episodeUrl(seasonUrl, latest - 1), String(latest - 1)));
  return chapters;
}

export function parseWiflixCatalog(html = "") {
  const results = [];
  const seen = new Set();
  const starts = [...html.matchAll(/<div class="mov clearfix">/gi)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const href = block.match(/<a[^>]*class="[^"]*mov-t[^"]*"[^>]*href="([^"]+)"/i)?.[1]
      || block.match(/data-link="([^"]+)"/i)?.[1]
      || "";
    const url = normalizeWiflixUrl(href);
    const slug = watchSlugFromUrl(url);
    if (!url || !slug || seen.has(slug)) return;
    const title = textOnly(
      block.match(/<a[^>]*class="[^"]*mov-t[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1]
        || block.match(/alt="([^"]+)"/i)?.[1]
        || "",
    );
    if (!title) return;
    seen.add(slug);
    const cover = absoluteMediaUrl(block.match(/<img[^>]*src="([^"]+)"/i)?.[1] ?? "");
    const movL = textOnly(block.match(/<div class="mov-l">([\s\S]*?)<\/div>/i)?.[1] ?? "");
    const year = textOnly(block.match(/<span class="nbloc1">([\s\S]*?)<\/span>/i)?.[1] ?? "")
      || (/^\d{4}$/.test(movL) ? movL : "");
    const audioLabel = normalizeWiflixAudioLabel(movL);
    const series = isSeriesCard(block, title);
    const latestEpisode = series ? parseLatestEpisode(block) : 0;
    const chapters = series
      ? seriesCatalogChapters(url, latestEpisode)
      : [watchEntry(url, "1")];
    results.push(applyRecentChapterFields({
      id: slug,
      title,
      altTitle: [audioLabel, year].filter(Boolean).join(" · "),
      url,
      cover,
      summary: "",
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType: series ? "series" : "movie",
      mediaTypeLabel: series ? "مسلسل" : "فيلم",
      audioLabel,
      year,
    }, chapters));
  });
  return results;
}

export function parseWiflixFilters(html = "") {
  const categories = [];
  const tags = [];
  const seen = { category: new Set(), tag: new Set() };
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    if (!href) continue;
    let target;
    try { target = new URL(href, DEFAULT_BASE_URL); } catch { continue; }
    if (!isAllowedHost(target.hostname)) continue;
    const path = `${target.pathname}${target.pathname.endsWith("/") ? "" : "/"}`;
    const name = textOnly(match[2]).replace(/^#/, "").trim();
    if (!name || name.length > 40) continue;
    const genre = path.match(/^\/genre\/([a-z0-9&%_.-]+)\/$/i)?.[1];
    if (genre) {
      const key = `category:${genre.toLowerCase()}`;
      if (seen.category.has(key)) continue;
      seen.category.add(key);
      categories.push({ slug: genre, name, count: 0, filterPath: `/genre/${genre}/` });
      continue;
    }
    const year = path.match(/^\/annee\/(\d{4})\/$/i)?.[1];
    if (year) {
      const key = `tag:year:${year}`;
      if (seen.tag.has(key)) continue;
      seen.tag.add(key);
      tags.push({ slug: year, name: year, count: 0, filterPath: `/annee/${year}/` });
    }
  }
  tags.sort((left, right) => Number(right.slug) - Number(left.slug));
  return { categories, tags };
}

export function relatedWiflixSearchQuery(title = "") {
  return String(title || "")
    .replace(/\s*\(\d{4}\)\s*$/, "")
    .replace(/\s*[-–—]?\s*saison\s+\d+\b.*$/i, "")
    .trim();
}

function normalizeTitleKey(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function wiflixSearchVariants(query = "") {
  const raw = String(query || "").trim();
  if (!raw) return [];
  const normalized = raw
    .replace(/\bs(?:aison)?\s*(\d+)\s*$/i, "saison $1")
    .replace(/\s+/g, " ")
    .trim();
  const variants = [raw, normalized];
  const saison = normalized.match(/^(.+?)\s+saison\s+(\d+)$/i);
  if (saison) {
    variants.push(`${saison[1].trim()}-saison-${saison[2]}`);
    variants.push(`${saison[1].trim()} - Saison ${saison[2]}`);
  }
  const words = normalized.split(" ").filter(Boolean);
  if (words.length === 1 && /^[a-z0-9]+$/i.test(words[0])) {
    variants.push(`${words[0]}-saison`);
  }
  const hyphen = normalized.replace(/\s+/g, "-");
  if (hyphen !== normalized) variants.push(hyphen);
  return [...new Set(variants.map((entry) => entry.trim()).filter(Boolean))];
}

export function wiflixSearchScore(title = "", query = "") {
  const tokens = normalizeTitleKey(title).split(" ").filter(Boolean);
  const queryTokens = normalizeTitleKey(String(query).replace(/-/g, " ")).split(" ").filter(Boolean);
  if (!tokens.length || !queryTokens.length) return 99;
  const titleKey = tokens.join(" ");
  const queryKey = queryTokens.join(" ");
  if (titleKey === queryKey) return 0;
  if (queryTokens.length === 1 && tokens[0] === queryTokens[0] && tokens[1] === "saison") return 1;
  if (tokens[0] === queryTokens[0] && queryTokens.every((part, index) => tokens[index] === part)) return 1;
  if (tokens[0] === queryTokens[0]) return 2;
  if (queryTokens.every((part) => tokens.includes(part))) return 3;
  if (titleKey.includes(queryKey)) return 4;
  return 5;
}

export function rankWiflixSearch(items = [], query = "") {
  return [...items].sort((left, right) => wiflixSearchScore(left.title, query) - wiflixSearchScore(right.title, query)
    || seasonNumberFromTitle(right.title) - seasonNumberFromTitle(left.title)
    || String(left.title).localeCompare(String(right.title)));
}

function mergeWiflixItems(groups = []) {
  const seen = new Set();
  const items = [];
  for (const group of groups) {
    for (const item of group || []) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

export function isRelatedWiflixTitle(currentTitle, candidateTitle, query) {
  const current = normalizeTitleKey(currentTitle);
  const candidate = normalizeTitleKey(candidateTitle);
  const needle = normalizeTitleKey(query);
  if (!candidate || candidate === current) return false;
  if (needle && (candidate === needle || candidate.startsWith(`${needle} `))) return true;
  const currentWords = current.split(" ").filter(Boolean);
  const candidateWords = candidate.split(" ").filter(Boolean);
  return currentWords.length >= 2
    && candidateWords.length >= 2
    && currentWords[0] === candidateWords[0]
    && currentWords[1] === candidateWords[1];
}

export function pickRelatedWiflixItems(items = [], { currentId, currentTitle, query, mediaType, limit = 12 } = {}) {
  const seen = new Set([String(currentId || "")]);
  const related = [];
  for (const item of items) {
    if (!item?.id || seen.has(String(item.id))) continue;
    if (mediaType && item.mediaType !== mediaType) continue;
    if (!isRelatedWiflixTitle(currentTitle, item.title, query)) continue;
    seen.add(String(item.id));
    related.push(item);
  }
  return related
    .sort((left, right) => seasonNumberFromTitle(left.title) - seasonNumberFromTitle(right.title)
      || Number(left.year || 0) - Number(right.year || 0))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      title: item.title,
      altTitle: item.altTitle || item.year || "",
      url: item.url,
      cover: item.cover,
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType: item.mediaType || mediaType || "movie",
      mediaTypeLabel: item.mediaTypeLabel || (item.mediaType === "series" ? "مسلسل" : "فيلم"),
      year: item.year || (/^\d{4}$/.test(String(item.altTitle || "")) ? item.altTitle : ""),
    }));
}

function seasonNumberFromTitle(title = "") {
  const match = String(title).match(/saison\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

export function catalogHasMore(html, page) {
  return new RegExp(`[?&]page=${page + 1}\\b`).test(html);
}

export function buildCatalogUrl(page, filterPath = MIXED_PATH) {
  const path = assertFilterPath(filterPath);
  const trimmed = path.replace(/\/+$/, "");
  if (page <= 1) return `${DEFAULT_BASE_URL}${path}`;
  return `${DEFAULT_BASE_URL}${trimmed}?page=${page}`;
}

function movListValue(html, label) {
  const pattern = new RegExp(
    `<div class="mov-label">\\s*${label}\\s*:?\\s*<\\/div>\\s*<div class="mov-desc">([\\s\\S]*?)<\\/div>`,
    "i",
  );
  return html.match(pattern)?.[1] ?? "";
}

function parseDetailsGenres(html = "") {
  const block = movListValue(html, "GENRE");
  const genres = [];
  for (const match of block.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)) {
    const name = textOnly(match[1]);
    if (name && !genres.includes(name)) genres.push(name);
  }
  return genres;
}

function parseDetailsYear(html = "") {
  const fromLabel = textOnly(movListValue(html, "Date de sortie"));
  if (/^\d{4}$/.test(fromLabel)) return fromLabel;
  return html.match(/<title>[^<]*\((\d{4})\)/i)?.[1] || "";
}

function parseSynopsis(html = "") {
  const after = html.match(/Synopsis:<\/h3>([\s\S]*?)(?:<div class="tabsbox|<div class="full-taglist|<div class="pagi-nav|$)/i)?.[1] ?? "";
  let text = textOnly(after);
  text = text.replace(/^R[ée]sum[ée]\s+du\s+(?:film|s[ée]rie)\s+.+?\s+en Streaming Complet:\s*/i, "").trim();
  return text;
}

function isSeriesHtml(html = "", title = "") {
  return /eplist|blocfr|blocvostfr/i.test(html) || /saison\s+\d+/i.test(title);
}

export function parseWiflixEpisodes(html = "", seasonUrl = "") {
  const vf = new Set();
  const vost = new Set();
  for (const match of html.matchAll(/language=(VF|VOSTFR)&(?:amp;)?episode=(\d+)/gi)) {
    const number = Number(match[2]);
    if (!Number.isFinite(number) || number < 1) continue;
    if (match[1].toUpperCase() === "VF") vf.add(number);
    else vost.add(number);
  }
  const numbers = [...new Set([...vf, ...vost])].sort((left, right) => left - right);
  return numbers.map((number) => {
    const audioLanguages = {};
    if (vf.has(number)) audioLanguages.VF = episodeUrl(seasonUrl, number, "VF");
    if (vost.has(number)) audioLanguages.VOSTFR = episodeUrl(seasonUrl, number, "VOSTFR");
    const defaultAudioLanguage = audioLanguages.VF ? "VF" : "VOSTFR";
    const url = audioLanguages[defaultAudioLanguage];
    return {
      ...watchEntry(url, String(number)),
      audioLanguages,
      defaultAudioLanguage,
    };
  });
}

export function parseWiflixDetails(html, url) {
  const canonical = assertWatchUrl(url);
  const slug = watchSlugFromUrl(canonical);
  const title = textOnly(
    html.match(/<h1[^>]*itemprop="name"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.split("|")[0]
      ?? "",
  ).replace(/^Wiflix:\s*/i, "").replace(/\s+en streaming complet.*$/i, "").replace(/\s*\(\d{4}\)\s*$/, "").trim();
  const originalTitle = textOnly(movListValue(html, "titre original"));
  const cover = absoluteMediaUrl(
    html.match(/id="posterimg"[^>]*src="([^"]+)"/i)?.[1]
      ?? html.match(/<img[^>]*id="posterimg"[^>]*src="([^"]+)"/i)?.[1]
      ?? "",
  );
  const year = parseDetailsYear(html);
  const series = isSeriesHtml(html, title);
  const chapters = series ? parseWiflixEpisodes(html, canonical) : [watchEntry(canonical, "1")];
  const hasVf = /language=VF&(?:amp;)?episode=/i.test(html);
  const hasVost = /language=VOSTFR&(?:amp;)?episode=/i.test(html);
  const audioLabel = series
    ? (hasVf && hasVost ? "VF+VOSTFR" : hasVost ? "VOSTFR" : hasVf ? "VF" : "")
    : normalizeWiflixAudioLabel(
      html.match(/data-version=(['"])([^'"]+)\1/i)?.[2]
        ?? textOnly(html.match(/<div class="version-option"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ""),
    );
  return {
    id: slug,
    title,
    altTitle: [originalTitle && originalTitle !== title ? originalTitle : "", year, audioLabel].filter(Boolean).join(" · "),
    cover,
    summary: parseSynopsis(html),
    url: canonical,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: series ? "series" : "movie",
    mediaTypeLabel: series ? "مسلسل" : "فيلم",
    audioLabel,
    categories: parseDetailsGenres(html).slice(0, 20),
    tags: [audioLabel].filter(Boolean),
    totalEpisodes: series ? chapters.length : 1,
    year,
    relatedItems: [],
    chapters,
    latestChapter: chapters[chapters.length - 1]?.number || "—",
    latestChapterUrl: chapters[chapters.length - 1]?.url || canonical,
    recentChapters: [],
  };
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
  const iframe = decodeHtml(html.match(/<iframe[^>]+src=(['"])([^'"]+)\1/i)?.[2] ?? "");
  pushPlayer(sources, seen, iframe, "", "");
  return sources.sort((left, right) => languageRank(left.version || left.audioLabel) - languageRank(right.version || right.audioLabel)
    || hostRank(left.url) - hostRank(right.url));
}

export function parseWiflixPlayback(html, details) {
  const sources = parseWiflixPlayers(html).map(({ label, url }) => ({ label, url }));
  const embedUrl = sources[0]?.url || "";
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

export function buildSearchUrl(query, page = 1) {
  const params = new URLSearchParams({ keywords: query });
  if (page > 1) params.set("page", String(page));
  return `${DEFAULT_BASE_URL}/search?${params}`;
}

async function fetchSearchHtml(query, page = 1) {
  return fetchWiflixHtml(buildSearchUrl(query, page));
}

async function searchWiflix(query, page = 1) {
  const variants = wiflixSearchVariants(query);
  const primary = variants[0] || query;
  if (page > 1) {
    const html = await fetchSearchHtml(primary, page);
    return {
      items: rankWiflixSearch(parseWiflixCatalog(html), query),
      hasMore: catalogHasMore(html, page),
    };
  }

  const variantHtml = await Promise.all(variants.slice(0, 3).map((variant) => fetchSearchHtml(variant, 1)));
  let items = mergeWiflixItems(variantHtml.map((html) => parseWiflixCatalog(html)));
  const singleWord = normalizeTitleKey(primary).split(" ").filter(Boolean).length === 1;
  const hasStrongMatch = items.some((item) => wiflixSearchScore(item.title, query) <= 1);
  const extraPages = singleWord && !hasStrongMatch ? 3 : 1;
  const pageHtml = extraPages > 1
    ? await Promise.all([2, 3].map((entry) => fetchSearchHtml(primary, entry)))
    : [];
  items = rankWiflixSearch(mergeWiflixItems([
    items,
    ...pageHtml.map((html) => parseWiflixCatalog(html)),
  ]), query);
  const lastHtml = pageHtml[pageHtml.length - 1] || variantHtml[0] || "";
  return {
    items,
    hasMore: extraPages > 1 ? catalogHasMore(lastHtml, extraPages) : catalogHasMore(variantHtml[0] || "", 1),
  };
}

async function fetchRelatedItems(title, currentId, mediaType) {
  const query = relatedWiflixSearchQuery(title);
  if (query.length < 3) return [];
  try {
    const { items } = await searchWiflix(query, 1);
    return pickRelatedWiflixItems(items, {
      currentId,
      currentTitle: title,
      query,
      mediaType,
    });
  } catch {
    return [];
  }
}

function toggleEpisodeLanguage(chapterUrl) {
  const episode = episodeNumberFromUrl(chapterUrl);
  if (!episode) return "";
  const next = episodeLanguageFromUrl(chapterUrl) === "VOSTFR" ? "VF" : "VOSTFR";
  return episodeUrl(chapterUrl, episode, next);
}

async function fetchPlayableChapter(target) {
  let html = await fetchWiflixHtml(target);
  if (parseWiflixPlayers(html).length) return { html, url: target };
  const alternate = toggleEpisodeLanguage(target);
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

  if (requestUrl.pathname.endsWith("/filters")) {
    const html = await fetchWiflixHtml(`${ctx.baseUrl}${MOVIES_PATH}`);
    const parsed = parseWiflixFilters(html);
    return responseJson(200, {
      kinds: [
        { slug: "all", name: "الكل", filterPath: MIXED_PATH },
        { slug: "movies", name: "أفلام", filterPath: MOVIES_PATH },
        { slug: "series", name: "مسلسلات", filterPath: SERIES_PATH },
      ],
      categories: parsed.categories,
      tags: parsed.tags,
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 2000);
    const filterPath = assertFilterPath(requestUrl.searchParams.get("filterPath")?.trim() || MIXED_PATH);
    if (filterPath === MIXED_PATH) {
      if (page <= 1) {
        const [homeHtml, filmsHtml, seriesHtml] = await Promise.all([
          fetchWiflixHtml(`${ctx.baseUrl}/`),
          fetchWiflixHtml(buildCatalogUrl(1, MOVIES_PATH)),
          fetchWiflixHtml(buildCatalogUrl(1, SERIES_PATH)),
        ]);
        return responseJson(200, {
          items: parseWiflixCatalog(homeHtml),
          page,
          hasMore: catalogHasMore(filmsHtml, page) || catalogHasMore(seriesHtml, page),
          fetchedAt: new Date().toISOString(),
        });
      }
      const [filmsHtml, seriesHtml] = await Promise.all([
        fetchWiflixHtml(buildCatalogUrl(page, MOVIES_PATH)),
        fetchWiflixHtml(buildCatalogUrl(page, SERIES_PATH)),
      ]);
      return responseJson(200, {
        items: mergeCatalogByRecency(parseWiflixCatalog(filmsHtml), parseWiflixCatalog(seriesHtml)),
        page,
        hasMore: catalogHasMore(filmsHtml, page) || catalogHasMore(seriesHtml, page),
        fetchedAt: new Date().toISOString(),
      });
    }
    const html = await fetchWiflixHtml(buildCatalogUrl(page, filterPath));
    return responseJson(200, {
      items: parseWiflixCatalog(html),
      page,
      hasMore: catalogHasMore(html, page),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 2000);
    const result = await searchWiflix(query, page);
    return responseJson(200, {
      items: result.items,
      page,
      hasMore: result.hasMore,
    });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertWatchUrl(requestUrl.searchParams.get("url") ?? "");
    const html = await fetchWiflixHtml(target);
    const details = parseWiflixDetails(html, target);
    const chapters = details.mediaType === "series" ? parseWiflixEpisodes(html, details.url) : details.chapters;
    return responseJson(200, applyRecentChapterFields({
      ...details,
      chapters,
      totalEpisodes: chapters.length,
      relatedItems: await fetchRelatedItems(details.title, details.id, details.mediaType),
    }, details.mediaType === "series" ? [...chapters].reverse() : chapters));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    let target = assertChapterUrl(requestUrl.searchParams.get("url") ?? "");
    let html = await fetchWiflixHtml(target);
    const details = parseWiflixDetails(html, target);
    if (details.mediaType === "series" && !episodeNumberFromUrl(target) && details.chapters.length) {
      target = details.chapters[details.chapters.length - 1].url;
      html = await fetchWiflixHtml(target);
    }
    const playable = await fetchPlayableChapter(target);
    const episode = episodeNumberFromUrl(playable.url);
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
