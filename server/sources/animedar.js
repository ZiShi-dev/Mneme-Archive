import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { enrichSourcesWithStreams } from "../lib/embedResolvers.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, recentChaptersFromCount } from "../lib/catalogChapters.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";

const DEFAULT_BASE_URL = "https://animedar.net";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
const SOURCE_NAME = "AnimeDar";
const SOURCE_ID = "animedar";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const EMBED_URL_BUILDERS = {
  videa: (id) => `https://videa.hu/player?v=${id}`,
  dailymotion: (id) => `https://www.dailymotion.com/embed/video/${id}`,
  mega: (id) => `https://mega.nz/embed/${id}`,
  drive: (id) => `https://drive.google.com/file/d/${id}/preview`,
  "4shared": (id) => `https://www.4shared.com/web/embed/file/${id}`,
  asnwish: (id) => `https://asnwish.com/e/${id}`,
  mp4upload: (id) => `https://www.mp4upload.com/embed-${id}.html`,
  uqload: (id) => `https://uqload.com/embed-${id}.html`,
  fembed: (id) => `https://www.fembed.com/v/${id}`,
  yourupload: (id) => `https://www.yourupload.com/embed/${id}`,
  upstream: (id) => `https://upstream.to/embed-${id}.html`,
  vidshar: (id) => `https://vidshar.org/embed-${id}.html`,
  vidbm: (id) => `https://vidbm.com/embed-${id}.html`,
  vedbom: (id) => `https://vedbom.com/embed-${id}.html`,
  goved: (id) => `https://goved.org/embed-${id}.html`,
  solidfiles: (id) => `https://www.solidfiles.com/v/${id}`,
  watchsb: (id) => `https://watchsb.com/e/${id}`,
  uptostream: (id) => `https://uptostream.com/iframe/${id}`,
  yuistream: (id) => `https://yuistream.xyz/v/${id}`,
  vidshare: (id) => `https://vidshare.tv/embed-${id}.html`,
  playtube: (id) => `https://playtube.ws/embed-${id}.html`,
  vanfem: (id) => `https://vanfem.com/v/${id}`,
  mediafire: (id) => `https://www.mediafire.com/file/${id}`,
  sendvid: (id) => `https://sendvid.com/embed/${id}`,
  okru: (id) => `https://www.ok.ru/videoembed/${id}`,
  youtube: (id) => `https://www.youtube.com/embed/${id}`,
  dood: (id) => `https://dood.so/e/${id}`,
  mixdrop: (id) => `https://mixdrop.to/e/${id}`,
  streamhub: (id) => `https://streamhub.to/e/${id}`,
  anime4up: (id) => `https://www.anime4up.net/player/${id}`,
  doodrive: (id) => `https://doodrive.com/e/${id}`,
  sblanh: (id) => `https://sblanh.com/e/${id}`,
  segavid: (id) => `https://segavid.com/embed-${id}.html`,
  govid: (id) => `https://govid.me/embed-${id}.html`,
  upvideo: (id) => `https://upvideo.to/e/${id}`,
  soraplay: (id) => `https://soraplay.xyz/embed/${id}`,
  samaup: (id) => `https://samaup.cc/embed-${id}.html`,
  userload: (id) => `https://userload.co/embed/${id}`,
  vidfast: (id) => `https://vidfast.co/embed-${id}.html`,
  vidbam: (id) => `https://vidbam.org/embed-${id}.html`,
  vidhd: (id) => `https://vidhd.net/embed-${id}.html`,
  vedshare: (id) => `https://vedshare.com/embed-${id}.html`,
  holavid: (id) => `https://holavid.com/embed-${id}.html`,
  yonaplay: (id) => `https://yonaplay.org/embed.php?id=${id}`,
};

function createFetcher(baseUrl = DEFAULT_BASE_URL) {
  return createCachedHtmlFetcher({
    ttlMs: 3 * 60_000,
    timeoutMs: 40_000,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ar,en;q=0.8",
      referer: `${baseUrl}/`,
      "user-agent": BROWSER_UA,
    },
    getVariants: (url) => [url],
    buildError: (lastStatus) => `AnimeDar a répondu ${lastStatus || "sans réponse"}`,
  });
}

function assertAnimedarHost(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("المصدر غير مسموح");
  }
  url.hostname = ctx.apex;
  url.hash = "";
  return url;
}

export function normalizeAnimedarUrl(rawUrl = "", { keepHost = false, ctx = DEFAULT_CTX } = {}) {
  const decoded = decodeHtml(String(rawUrl || "").trim());
  if (!decoded) return "";
  try {
    const url = new URL(decoded, ctx.baseUrl);
    if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) return "";
    if (!keepHost) url.hostname = ctx.hostname;
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function assertAnimeUrl(rawUrl, ctx = DEFAULT_CTX) {
  const url = assertAnimedarHost(rawUrl, ctx);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "anime-p" || parts.length !== 2) throw new Error("رابط AnimeDar غير صالح");
  return url.toString().endsWith("/") ? url.toString() : `${url.toString()}/`;
}

export function slugFromAnimeUrl(rawUrl = "", ctx = DEFAULT_CTX) {
  const url = assertAnimedarHost(rawUrl, ctx);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "anime-p" && parts[1]) return parts[1];
  throw new Error("رابط AnimeDar غير صالح");
}

export function buildEpisodeUrl(animeUrl, episodeNumber, ctx = DEFAULT_CTX) {
  const base = assertAnimeUrl(animeUrl, ctx);
  const url = new URL(base);
  url.searchParams.set("ep", String(Math.max(1, Number(episodeNumber) || 1)));
  return url.toString();
}

export function parseEpisodeTarget(rawUrl = "", ctx = DEFAULT_CTX) {
  const url = assertAnimedarHost(rawUrl, ctx);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "anime-p" || !parts[1]) throw new Error("رابط حلقة AnimeDar غير صالح");
  const episode = Math.max(1, Number(url.searchParams.get("ep")) || 1);
  url.searchParams.delete("ep");
  const animeUrl = url.toString().endsWith("/") ? url.toString() : `${url.toString()}/`;
  return { animeUrl, episode, slug: parts[1] };
}

function assertAnimedarImageUrl(rawUrl, ctx = DEFAULT_CTX) {
  const decoded = decodeHtml(String(rawUrl || "").trim());
  const url = new URL(decoded);
  if (url.protocol !== "https:") throw new Error("رابط الصورة غير مسموح");
  const host = url.hostname.toLowerCase();
  const allowed = host === ctx.apex
    || host === `www.${ctx.apex}`
    || host === `i0.wp.com`
    || host === `i1.wp.com`
    || host === `i2.wp.com`;
  if (!allowed) throw new Error("رابط الصورة غير مسموح");
  if (host.endsWith(".wp.com") && !url.pathname.includes("/animedar.net/wp-content/")) {
    throw new Error("رابط الصورة غير مسموح");
  }
  if ((host === ctx.apex || host === `www.${ctx.apex}`) && !url.pathname.startsWith("/wp-content/uploads/")) {
    throw new Error("رابط الصورة غير مسموح");
  }
  return url.toString();
}

function episodeNumberFromLabel(label = "") {
  const match = textOnly(label).match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : "";
}

function parseLatestEpisodeLabel(block = "") {
  return textOnly(block.match(/<div class="ep-number"[^>]*>\s*<span>([^<]+)/i)?.[1] ?? "");
}

function parseCardType(block = "") {
  return textOnly(block.match(/<div class="typez[^"]*"[^>]*>([^<]+)/i)?.[1] ?? "");
}

function resolveMediaType(typeLabel = "") {
  const normalized = textOnly(typeLabel);
  if (/فيلم|movie/i.test(normalized)) {
    return { mediaType: "movie", mediaTypeLabel: "فيلم" };
  }
  return { mediaType: "anime", mediaTypeLabel: "أنمي" };
}

export function parseAnimedarCatalog(html = "", baseUrl = DEFAULT_BASE_URL) {
  const results = [];
  const seen = new Set();
  const starts = [...html.matchAll(/<article class="bs ss1"[\s\S]*?itemtype="http:\/\/schema\.org\/CreativeWork">/gi)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const link = block.match(/<a[^>]*href="(https?:\/\/[^"/]+\/anime-p\/[^"?#]+\/?)"[^>]*itemprop="url"/i);
    if (!link) return;
    const url = normalizeAnimedarUrl(link[1], { ctx: createHostContext(baseUrl) });
    if (!url || seen.has(url)) return;
    seen.add(url);
    const title = textOnly(
      block.match(/<h2[^>]*itemprop="headline"[^>]*>([\s\S]*?)<\/h2>/i)?.[1]
        ?? block.match(/itemprop="url"[^>]*title="([^"]+)"/i)?.[1]
        ?? "",
    );
    if (!title) return;
    const cover = decodeHtml(block.match(/<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]+)"/i)?.[1] ?? "");
    const latestLabel = parseLatestEpisodeLabel(block);
    const latestNumber = episodeNumberFromLabel(latestLabel);
    const recentChapters = latestNumber
      ? [{ number: latestNumber, name: latestLabel || `الحلقة ${latestNumber}`, url: buildEpisodeUrl(url, latestNumber, createHostContext(baseUrl)) }]
      : [];
    const media = resolveMediaType(parseCardType(block));
    results.push(applyRecentChapterFields({
      id: slugFromAnimeUrl(url, createHostContext(baseUrl)),
      title,
      altTitle: "",
      url,
      cover,
      summary: "",
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      audioLabel: "مترجم",
      ...media,
    }, recentChapters));
  });
  return results;
}

function parseServerLi(liHtml = "") {
  const data = liHtml.match(/(?:^|\s)data="([^"]+)"/i)?.[1];
  const type = liHtml.match(/(?:^|\s)type="([^"]+)"/i)?.[1]?.toLowerCase();
  const quality = liHtml.match(/quality-data="([^"]+)"/i)?.[1] || "";
  const label = textOnly(liHtml.match(/>([^<]+)</)?.[1] || type || "سيرفر");
  if (!data || !type) return null;
  return { data, type, quality, label };
}

export function buildServerEmbedUrl(server = {}) {
  const builder = EMBED_URL_BUILDERS[server.type];
  if (!builder) return "";
  return builder(server.data);
}

export function parseAnimedarServerBlocks(html = "") {
  return [...html.matchAll(/<div class="divv11"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi)].map((match) => {
    const servers = [];
    const seen = new Set();
    for (const li of match[1].matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)) {
      const parsed = parseServerLi(li[0]);
      if (!parsed) continue;
      const embedUrl = buildServerEmbedUrl(parsed);
      if (!embedUrl || seen.has(embedUrl)) continue;
      seen.add(embedUrl);
      servers.push({
        label: parsed.quality ? `${parsed.label} ${parsed.quality}` : parsed.label,
        url: embedUrl,
        type: parsed.type,
      });
    }
    return servers;
  });
}

export function parseAnimedarEpisodes(html = "", animeUrl = "", ctx = DEFAULT_CTX) {
  const base = assertAnimeUrl(animeUrl, ctx);
  const csbNumbers = [...html.matchAll(/id=['"]IDSB(\d+)['"][^>]*>([^<]+)/gi)]
    .map((match) => ({
      number: episodeNumberFromLabel(match[2]) || match[1],
      name: textOnly(match[2]),
    }));
  const serverBlocks = parseAnimedarServerBlocks(html);
  const total = Math.max(csbNumbers.length, serverBlocks.length, Number(html.match(/<b>الحلقات:<\/b>\s*(\d+)/i)?.[1] ?? 0));
  const episodes = [];
  for (let index = 0; index < total; index += 1) {
    const number = csbNumbers[index]?.number || String(index + 1);
    const name = csbNumbers[index]?.name || `الحلقة ${number}`;
    episodes.push({
      url: buildEpisodeUrl(base, number, ctx),
      name,
      number: String(number),
      date: "",
      locked: false,
    });
  }
  return episodes.sort((a, b) => Number(b.number) - Number(a.number));
}

function parseInfoValue(html, label) {
  const match = html.match(new RegExp(`<b>${label}:<\\/b>\\s*([^<]+)`, "i"))
    ?? html.match(new RegExp(`<b>${label}:<\\/b>\\s*<a[^>]*>([\\s\\S]*?)<\\/a>`, "i"));
  return textOnly(match?.[1] ?? "");
}

export function parseAnimedarDetails(html = "", url = "", chapters = [], ctx = DEFAULT_CTX) {
  const animeUrl = assertAnimeUrl(url, ctx);
  const slug = slugFromAnimeUrl(animeUrl, ctx);
  const title = textOnly(html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]?.split("|")[0]
    ?? "");
  const altTitle = textOnly(html.match(/<span class="alter">([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const cover = decodeHtml(
    html.match(/<div class="thumb"[\s\S]*?<img[^>]*src="([^"]+)"/i)?.[1]
      ?? html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1]
      ?? "",
  );
  const summary = textOnly(html.match(/<div class="mindesc">([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const categories = [...html.matchAll(/<a href="https:\/\/animedar\.net\/genres\/[^"]+"[^>]*>([^<]+)/gi)]
    .map((match) => textOnly(match[1]))
    .filter(Boolean)
    .slice(0, 20);
  const tags = [
    parseInfoValue(html, "الموسم"),
    parseInfoValue(html, "الاستوديو"),
  ].filter(Boolean);
  const sorted = [...chapters].sort((a, b) => Number(b.number) - Number(a.number));
  const latest = sorted[0];
  const media = resolveMediaType(parseInfoValue(html, "النوع"));
  return enrichSourceDetails({
    id: slug,
    title,
    altTitle,
    cover,
    summary,
    url: animeUrl,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    ...media,
    categories,
    tags,
    totalEpisodes: Number(parseInfoValue(html, "الحلقات")) || sorted.length,
    year: parseInfoValue(html, "تم الإصدار"),
    status: parseInfoValue(html, "الحالة"),
    chapters: sorted,
    latestChapter: latest?.number ?? "—",
    latestChapterUrl: latest?.url ?? null,
    recentChapters: sorted.slice(0, 2),
    audioLabel: "مترجم",
  });
}

export async function parseAnimedarEpisodePlayback(html = "", episodeUrl = "", ctx = DEFAULT_CTX) {
  const target = parseEpisodeTarget(episodeUrl, ctx);
  const serverBlocks = parseAnimedarServerBlocks(html);
  const servers = serverBlocks[target.episode - 1] || [];
  if (!servers.length) throw new Error("تعذر استخراج سيرفرات الحلقة");
  const enriched = await enrichSourcesWithStreams(servers, target.animeUrl);
  const playable = enriched.find((entry) => entry.streamUrl) || enriched[0];
  const title = textOnly(
    html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? `الحلقة ${target.episode}`,
  );
  if (playable?.streamUrl) {
    return {
      title: `${title} — الحلقة ${target.episode}`,
      url: buildEpisodeUrl(target.animeUrl, target.episode, ctx),
      kind: "video",
      sources: enriched.filter((entry) => entry.streamUrl),
      videoUrl: playable.streamUrl,
      streamUrl: playable.streamUrl,
      streamReferer: playable.streamReferer || playable.url,
      playbackMode: "hls",
      activeSource: playable.label,
      embedUrl: "",
      playerUrl: buildEpisodeUrl(target.animeUrl, target.episode, ctx),
    };
  }
  return {
    title: `${title} — الحلقة ${target.episode}`,
    url: buildEpisodeUrl(target.animeUrl, target.episode, ctx),
    kind: "video",
    sources: enriched,
    embedUrl: playable?.url || enriched[0]?.url || "",
    playbackMode: playable?.url ? "embed" : undefined,
    streamUrl: "",
    videoUrl: "",
    playerUrl: buildEpisodeUrl(target.animeUrl, target.episode, ctx),
  };
}

export function parseAnimedarFilterLinks(html = "", baseUrl = DEFAULT_BASE_URL) {
  const categories = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a[^>]*href="(https:\/\/animedar\.net\/genres\/[^"?#]+\/?)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = normalizeAnimedarUrl(match[1], { ctx: createHostContext(baseUrl) });
    const name = textOnly(match[2]);
    const slug = url ? new URL(url).pathname.split("/").filter(Boolean).pop() : "";
    const key = `${slug}:${name}`;
    if (!url || !name || seen.has(key)) continue;
    seen.add(key);
    categories.push({ slug, name, count: 0, filterPath: new URL(url).pathname });
  }
  return { categories, tags: [] };
}

function catalogHasMore(html, page) {
  return new RegExp(`/page/${page + 1}/`, "i").test(html);
}

function buildCatalogUrl(page, filterPath = "/", baseUrl = DEFAULT_BASE_URL) {
  const normalized = filterPath.startsWith("/") ? filterPath : `/${filterPath}`;
  if (page <= 1) return `${baseUrl}${normalized === "/" ? "/" : normalized}`;
  const trimmed = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  return `${baseUrl}${trimmed}/page/${page}/`;
}

function isValidAnimedarFilterPath(filterPath = "") {
  if (filterPath === "/") return true;
  return /^\/[\p{L}\p{N}/+_.%-]+\/?$/u.test(filterPath) && !filterPath.includes("..");
}

export async function handleAnimedarRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: SOURCE_NAME });
  const fetchHtml = createFetcher(ctx.baseUrl);

  if (requestUrl.pathname.endsWith("/image")) {
    const target = assertAnimedarImageUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    return fetchProxiedImage(target, `${ctx.baseUrl}/`, SOURCE_NAME);
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const html = await fetchHtml(`${ctx.baseUrl}/anime-p/`);
    return responseJson(200, { ...parseAnimedarFilterLinks(html, ctx.baseUrl), fetchedAt: new Date().toISOString() });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const filterPath = requestUrl.searchParams.get("filterPath")?.trim() || "/";
    if (!isValidAnimedarFilterPath(filterPath)) {
      throw new Error("مسار فلتر AnimeDar غير صالح");
    }
    const html = await fetchHtml(buildCatalogUrl(page, filterPath, ctx.baseUrl));
    return responseJson(200, {
      items: parseAnimedarCatalog(html, ctx.baseUrl),
      page,
      hasMore: catalogHasMore(html, page),
      fetchedAt: new Date().toISOString(),
    });
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const html = await fetchHtml(`${ctx.baseUrl}/?s=${encodeURIComponent(query)}`);
    return responseJson(200, { items: parseAnimedarCatalog(html, ctx.baseUrl), page: 1, hasMore: false });
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertAnimeUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    const html = await fetchHtml(target);
    const chapters = parseAnimedarEpisodes(html, target, ctx);
    return responseJson(200, parseAnimedarDetails(html, target, chapters, ctx));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = requestUrl.searchParams.get("url") ?? "";
    parseEpisodeTarget(target, ctx);
    const animeUrl = assertAnimeUrl(new URL(target).origin + new URL(target).pathname, ctx);
    const html = await fetchHtml(animeUrl);
    return responseJson(200, await parseAnimedarEpisodePlayback(html, target, ctx));
  }

  return responseJson(404, { error: "Route AnimeDar inconnue" });
}
