import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { fetchSkyChapter, fetchSkyNovelChapters, SKY_APP_ONLY_CHAPTER_MESSAGE } from "../lib/skynovelApi.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/responseJson.js";
import { applyRecentChapterFields, recentChaptersFromCount } from "../lib/catalogChapters.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";

const DEFAULT_BASE_URL = "https://realmnovel.com";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
const SOURCE_NAME = "Realm Novel";
const SOURCE_ID = "realmnovel";
/** Chapitres 1–50 en HTML public ; 51+ via API Sky Novel (même contenu que l’app). */
const FREE_WEB_CHAPTERS = 50;
const CATALOG_PAGE_SIZE = 24;
const FILTER_SCAN_MAX_PAGES = 25;
/** Pages parcourues pour construire la liste des genres/étiquettes (bootstrap rapide). */
const FILTER_BOOTSTRAP_PAGES = 6;
const FILTER_SCAN_BATCH_SIZE = 3;
const REALM_TYPE_CATEGORIES = new Set(["مترجمة", "مؤلفة"]);
const realmFiltersCache = new Map();

function createFetcher(baseUrl = DEFAULT_BASE_URL) {
  return createCachedHtmlFetcher({
    ttlMs: 3 * 60_000,
    timeoutMs: 35_000,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ar,en;q=0.8",
      referer: `${baseUrl}/`,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    getVariants: (url) => [url],
    buildError: (lastStatus) => `Realm Novel a répondu ${lastStatus || "sans réponse"}`,
  });
}

async function fetchRealmJson(path, { searchParams = {}, baseUrl = DEFAULT_BASE_URL } = {}) {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "accept-language": "ar,en;q=0.8",
      referer: `${baseUrl}/`,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(35_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(`Realm Novel JSON a répondu ${response.status}`);
  }
  return data;
}

function mapRealmCatalogChapters(novelId, totalChapters, baseUrl = DEFAULT_BASE_URL) {
  return recentChaptersFromCount(
    totalChapters,
    (number) => buildChapterUrl(novelId, number, baseUrl),
    undefined,
    { sourceId: SOURCE_ID },
  );
}

function mapMoreCatalogDoc(entry = {}, baseUrl = DEFAULT_BASE_URL) {
  const novelId = entry.id;
  if (!novelId || !entry.title) return null;
  const totalChapters = Number(entry.chapters) || 0;
  const recentChapters = mapRealmCatalogChapters(novelId, totalChapters, baseUrl);
  const tags = Array.isArray(entry.tags) ? entry.tags.map((tag) => String(tag).trim()).filter(Boolean) : [];
  const categories = entry.category ? [String(entry.category).trim()].filter(Boolean) : [];
  return applyRecentChapterFields({
    id: novelId,
    title: entry.title,
    altTitle: entry.titleEn || "",
    url: buildNovelUrl(novelId, baseUrl),
    cover: `${baseUrl}/img/novel/${novelId}.jpg`,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    categories,
    tags,
    publicationStatusLabel: entry.status || "",
  }, recentChapters);
}

export function parseRealmMoreCatalog(data, baseUrl = DEFAULT_BASE_URL) {
  const docs = Array.isArray(data?.docs) ? data.docs : [];
  return docs.map((entry) => mapMoreCatalogDoc(entry, baseUrl)).filter(Boolean);
}

async function fetchMoreCatalog(page, { q = "", tag = "", genre = "", baseUrl = DEFAULT_BASE_URL } = {}) {
  const selected = String(tag || genre || "").trim();
  const typeCategory = REALM_TYPE_CATEGORIES.has(selected) ? selected : "";
  const genreTag = typeCategory ? "" : selected;

  if (typeCategory) {
    const matched = [];
    const need = page * CATALOG_PAGE_SIZE + 1;
    for (let upstreamPage = 1; upstreamPage <= FILTER_SCAN_MAX_PAGES && matched.length < need; upstreamPage += 1) {
      const data = await fetchRealmJson("/_more", {
        searchParams: {
          page: String(upstreamPage),
          q,
        },
        baseUrl,
      });
      const docs = Array.isArray(data?.docs) ? data.docs : [];
      for (const doc of docs) {
        if (String(doc?.category || "").trim() === typeCategory) matched.push(doc);
      }
      if (!data?.hasMore || !docs.length) break;
    }
    const start = (page - 1) * CATALOG_PAGE_SIZE;
    const slice = matched.slice(start, start + CATALOG_PAGE_SIZE);
    return {
      items: slice.map((entry) => mapMoreCatalogDoc(entry, baseUrl)).filter(Boolean),
      hasMore: matched.length > start + CATALOG_PAGE_SIZE,
    };
  }

  const data = await fetchRealmJson("/_more", {
    searchParams: {
      page: String(page),
      q,
      tag: genreTag,
    },
    baseUrl,
  });
  const items = parseRealmMoreCatalog(data, baseUrl);
  return {
    items,
    hasMore: Boolean(data?.hasMore) && items.length > 0,
  };
}

export function buildRealmFiltersFromDocs(docs = []) {
  const tagCounts = new Map();
  const categoryCounts = new Map();
  for (const entry of docs) {
    const category = String(entry?.category || "").trim();
    if (category) categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    for (const raw of Array.isArray(entry?.tags) ? entry.tags : []) {
      const tag = String(raw || "").trim();
      if (!tag) continue;
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const toEntries = (counts) => [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ar"))
    .map(([name, count]) => ({ slug: name, name, count }));

  const categories = toEntries(categoryCounts);
  const tags = toEntries(tagCounts);
  // Les « catégories » UI = types (مترجمة/مؤلفة) + genres (tags), car le site filtre surtout via ?tag=
  const genreAsCategories = tags.map((entry) => ({ ...entry }));
  return {
    categories: [...categories, ...genreAsCategories.filter((entry) => !categoryCounts.has(entry.slug))],
    tags,
  };
}

async function fetchRealmMoreDocs(page, baseUrl) {
  const data = await fetchRealmJson("/_more", {
    searchParams: { page: String(page) },
    baseUrl,
  });
  return {
    docs: Array.isArray(data?.docs) ? data.docs : [],
    hasMore: Boolean(data?.hasMore),
  };
}

async function collectFilterTags(_fetchRealmHtml, baseUrl) {
  const cacheKey = baseUrl;
  const cached = realmFiltersCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 30 * 60_000) return cached.data;

  const docs = [];
  for (let start = 1; start <= FILTER_BOOTSTRAP_PAGES; start += FILTER_SCAN_BATCH_SIZE) {
    const pages = Array.from(
      { length: FILTER_SCAN_BATCH_SIZE },
      (_, index) => start + index,
    ).filter((page) => page <= FILTER_BOOTSTRAP_PAGES);
    const settled = await Promise.allSettled(
      pages.map((page) => fetchRealmMoreDocs(page, baseUrl)),
    );
    let hasMore = false;
    for (const entry of settled) {
      if (entry.status !== "fulfilled") continue;
      docs.push(...entry.value.docs);
      if (entry.value.hasMore) hasMore = true;
    }
    if (!hasMore) break;
  }

  const filters = buildRealmFiltersFromDocs(docs);
  realmFiltersCache.set(cacheKey, { at: Date.now(), data: filters });
  return filters;
}

function assertRealmHost(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("المصدر غير مسموح");
  }
  url.hostname = ctx.apex;
  url.hash = "";
  return url;
}

function assertRealmImageUrl(rawUrl, ctx = DEFAULT_CTX) {
  const url = assertRealmHost(rawUrl, ctx);
  if (!url.pathname.startsWith("/img/novel/")) throw new Error("رابط الصورة غير مسموح");
  return url.toString();
}

function buildNovelUrl(novelId, baseUrl = DEFAULT_BASE_URL) {
  return `${baseUrl}/novel/${novelId}`;
}

function buildChapterUrl(novelId, chapterNumber, baseUrl = DEFAULT_BASE_URL) {
  return `${baseUrl}/novel/${novelId}/chapter/${chapterNumber}`;
}

export function novelIdFromUrl(rawUrl, ctx = DEFAULT_CTX) {
  const url = assertRealmHost(rawUrl, ctx);
  const match = url.pathname.match(/^\/novel\/([a-f0-9]{24})(?:\/chapter\/(\d+))?$/i);
  if (!match?.[1]) throw new Error("رابط Realm Novel غير صالح");
  return {
    novelId: match[1],
    chapterNumber: match[2] ? Number(match[2]) : null,
  };
}

function parseTotalChapters(text = "") {
  const match = text.match(/(\d+)\s*فصل/) || text.match(/📖\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

function parseCatalogCard(block = "", baseUrl = DEFAULT_BASE_URL) {
  const href = block.match(/href="(\/novel\/[a-f0-9]{24})"/i)?.[1];
  if (!href) return null;
  const novelId = href.split("/").pop();
  const title = decodeHtml(block.match(/class="g3title"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
  const altTitle = decodeHtml(block.match(/class="g3sub"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
  const favBtn = block.match(/data-fav-btn[^>]*data-chapters="(\d+)"/i);
  const chapsText = block.match(/class="g3chaps"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "";
  const totalChapters = favBtn ? Number(favBtn[1]) : parseTotalChapters(chapsText);
  const coverPath = block.match(/src="(\/img\/novel\/[^"]+)"/i)?.[1] ?? `/img/novel/${novelId}.jpg`;
  const recentChapters = mapRealmCatalogChapters(novelId, totalChapters, baseUrl);
  return applyRecentChapterFields({
    id: novelId,
    title,
    altTitle,
    url: buildNovelUrl(novelId, baseUrl),
    cover: `${baseUrl}${coverPath}`,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
  }, recentChapters);
}

export function parseRealmCatalog(html, baseUrl = DEFAULT_BASE_URL) {
  const results = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a class="g3card"[\s\S]*?<\/a>/gi)) {
    const item = parseCatalogCard(match[0], baseUrl);
    if (!item?.title || seen.has(item.id)) continue;
    seen.add(item.id);
    results.push(item);
  }
  return results;
}

function parseNovelHead(html, novelId, baseUrl = DEFAULT_BASE_URL) {
  const headBlock = html.match(/<article class="novel-head"[\s\S]*?<\/article>/i)?.[0] ?? "";
  const title = textOnly(headBlock.match(/<h1 class="h1">([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const altTitle = textOnly(headBlock.match(/<h2 class="sub">([\s\S]*?)<\/h2>/i)?.[1] ?? "");
  const altTitle2 = textOnly(headBlock.match(/<p class="sub">([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const coverPath = headBlock.match(/<img[^>]*src="(\/img\/novel\/[^"]+)"/i)?.[1]
    ?? `/img/novel/${novelId}.jpg`;
  const summary = textOnly(headBlock.match(/<p class="desc">([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const badges = [...headBlock.matchAll(/<span class="badge">([\s\S]*?)<\/span>/gi)]
    .map((entry) => textOnly(entry[1]))
    .filter(Boolean);
  const favChapters = headBlock.match(/data-chapters="(\d+)"/i)?.[1];
  const totalChapters = favChapters ? Number(favChapters) : parseTotalChapters(badges.join(" "));
  const tags = [...headBlock.matchAll(/<a class="tag"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((entry) => textOnly(entry[1]))
    .filter(Boolean);
  return {
    title,
    altTitle: altTitle || altTitle2,
    cover: `${baseUrl}${coverPath}`,
    summary,
    totalChapters,
    tags,
    categories: badges.filter((badge) => !/^\d+\s*فصل$/u.test(badge) && !/^(مستمرة|مكتملة|مترجمة|مؤلفة)$/u.test(badge)),
  };
}

function parseChapterRows(html, novelId, baseUrl = DEFAULT_BASE_URL) {
  const chapters = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a class="chapter-row([^"]*)"[^>]*href="\/novel\/[a-f0-9]{24}\/chapter\/(\d+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const number = match[2];
    if (seen.has(number)) continue;
    seen.add(number);
    const label = textOnly(match[3]);
    chapters.push({
      url: buildChapterUrl(novelId, number, baseUrl),
      name: label || number,
      number,
      date: "",
      locked: false,
    });
  }
  return chapters;
}

function extendChapterList(chapters, totalChapters, novelId, baseUrl = DEFAULT_BASE_URL) {
  if (!totalChapters || totalChapters <= chapters.length) return chapters;
  const seen = new Set(chapters.map((chapter) => chapter.number));
  const extended = [...chapters];
  for (let n = 1; n <= totalChapters; n += 1) {
    const key = String(n);
    if (seen.has(key)) continue;
    extended.push({
      url: buildChapterUrl(novelId, n, baseUrl),
      name: key,
      number: key,
      date: "",
      locked: false,
    });
  }
  return extended.sort((a, b) => Number(a.number) - Number(b.number));
}

export function applyRealmChapterAccess(chapters = []) {
  return chapters.map((chapter) => {
    const next = { ...chapter, locked: false, permanentlyLocked: false };
    if (next.lockReason === "sky-app") delete next.lockReason;
    return next;
  });
}

export function mergeRealmChapterLists(fromHtml = [], fromSky = []) {
  const byNumber = new Map();
  for (const chapter of fromHtml) {
    const key = String(chapter?.number || "");
    if (!key) continue;
    byNumber.set(key, { ...chapter, locked: false });
  }
  for (const chapter of fromSky) {
    const key = String(chapter?.number || "");
    if (!key) continue;
    const previous = byNumber.get(key);
    byNumber.set(key, {
      ...(previous || {}),
      ...chapter,
      url: chapter.url || previous?.url,
      name: chapter.name || previous?.name || key,
      number: key,
      date: chapter.date || previous?.date || "",
      publishedAt: chapter.publishedAt || previous?.publishedAt || "",
      locked: false,
    });
  }
  return [...byNumber.values()].sort((a, b) => Number(a.number) - Number(b.number));
}

export function mapSkyChaptersToRealm(list = [], novelId, baseUrl = DEFAULT_BASE_URL) {
  return list
    .map((entry) => {
      const number = Number(entry?.chapterNumber ?? entry?.number);
      if (!Number.isFinite(number) || number < 1) return null;
      const key = String(number);
      const rawTitle = textOnly(entry?.title || entry?.name || key) || key;
      const stripped = rawTitle.replace(/^الفصل\s*/i, "").trim();
      let name = rawTitle;
      if (/^\d+(?:\.\d+)?$/.test(stripped) && stripped !== key) {
        name = `الفصل ${key} · ${stripped}`;
      } else if (!/^الفصل\s+/i.test(rawTitle)) {
        name = `الفصل ${key}${rawTitle && rawTitle !== key ? ` · ${rawTitle}` : ""}`;
      }
      return {
        url: buildChapterUrl(novelId, number, baseUrl),
        name,
        number: key,
        date: entry?.createdAt || entry?.updatedAt || "",
        publishedAt: entry?.createdAt || "",
        locked: false,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.number) - Number(b.number));
}

export function parseRealmFollowLatest(html, novelId, baseUrl = DEFAULT_BASE_URL) {
  const head = parseNovelHead(html, novelId, baseUrl);
  const latestNumber = Number(head.totalChapters) || 0;
  const chapters = latestNumber > 0
    ? [{
      url: buildChapterUrl(novelId, latestNumber, baseUrl),
      number: String(latestNumber),
      name: String(latestNumber),
      locked: false,
    }]
    : [];

  return {
    id: novelId,
    title: head.title,
    altTitle: head.altTitle,
    cover: head.cover,
    url: buildNovelUrl(novelId, baseUrl),
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    chapters,
  };
}

export function parseRealmDetails(html, novelId, baseUrl = DEFAULT_BASE_URL, skyChapters = null) {
  const head = parseNovelHead(html, novelId, baseUrl);
  const skyAvailable = Array.isArray(skyChapters) && skyChapters.length > 0;
  const fromSky = skyAvailable ? mapSkyChaptersToRealm(skyChapters, novelId, baseUrl) : [];
  const fromHtml = extendChapterList(parseChapterRows(html, novelId, baseUrl), head.totalChapters, novelId, baseUrl);
  const chapters = applyRealmChapterAccess(mergeRealmChapterLists(fromHtml, fromSky));
  const headBlock = html.match(/<article class="novel-head"[\s\S]*?<\/article>/i)?.[0] ?? "";
  const statusBadges = [...headBlock.matchAll(/<span class="badge">([\s\S]*?)<\/span>/gi)]
    .map((entry) => textOnly(entry[1]))
    .filter(Boolean);
  return enrichSourceDetails({
    id: novelId,
    title: head.title,
    altTitle: head.altTitle,
    cover: head.cover,
    summary: head.summary,
    url: buildNovelUrl(novelId, baseUrl),
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    categories: head.categories,
    tags: head.tags,
    chapters,
    statusBadges,
  }, { parser: "badges" });
}

function extractRealmChapterParagraphs(html = "") {
  const block = html.match(/<div class="chapter-content">([\s\S]*?)<\/div>/i)?.[1] ?? "";
  return [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => textOnly(match[1]))
    .filter((text) => text && text.length > 1);
}

export function isRealmChapterWebLocked(html = "") {
  if (/غير متاح على الموقع/i.test(html)) return true;
  return !extractRealmChapterParagraphs(html).length && html.includes('class="locked"');
}

export function parseRealmChapter(html, url) {
  const paragraphs = extractRealmChapterParagraphs(html);
  const title = textOnly(html.match(/<h1 class="h1"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "فصل");
  if (!paragraphs.length) {
    if (isRealmChapterWebLocked(html)) {
      throw new Error(SKY_APP_ONLY_CHAPTER_MESSAGE);
    }
    throw new Error("تعذر استخراج محتوى الفصل");
  }
  return {
    title,
    url,
    kind: "novel",
    paragraphs,
    pages: [],
  };
}

function catalogHasMore(html, page) {
  return new RegExp(`href="\\?page=${page + 1}"`, "i").test(html)
    || new RegExp(`href="[^"]*page=${page + 1}`, "i").test(html);
}

function buildCatalogUrl(page, { genre = "", tag = "", baseUrl = DEFAULT_BASE_URL } = {}) {
  const query = new URL(`${baseUrl}/`);
  if (page > 1) query.searchParams.set("page", String(page));
  if (tag) query.searchParams.set("tag", tag);
  if (genre && !tag) query.searchParams.set("tag", genre);
  return query.toString();
}

export async function handleRealmNovelRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: SOURCE_NAME });
  const { baseUrl } = ctx;
  const fetchRealmHtml = createFetcher(baseUrl);

  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(assertRealmImageUrl(requestUrl.searchParams.get("url") ?? "", ctx), `${baseUrl}/`, SOURCE_NAME);
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const filters = await collectFilterTags(fetchRealmHtml, baseUrl);
    return responseJson(200, { ...filters, fetchedAt: new Date().toISOString() });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() || "";
    const tag = requestUrl.searchParams.get("tag")?.trim() || genre;
    try {
      const { items, hasMore } = await fetchMoreCatalog(page, { tag, genre, baseUrl });
      return responseJson(200, {
        items,
        page,
        genre,
        tag,
        hasMore,
        fetchedAt: new Date().toISOString(),
      });
    } catch {
      const html = await fetchRealmHtml(buildCatalogUrl(page, { genre, tag, baseUrl }));
      const items = parseRealmCatalog(html, baseUrl);
      return responseJson(200, {
        items,
        page,
        genre,
        tag,
        hasMore: catalogHasMore(html, page) && items.length >= CATALOG_PAGE_SIZE,
        fetchedAt: new Date().toISOString(),
      });
    }
  }

  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() || "";
    const tag = requestUrl.searchParams.get("tag")?.trim() || genre;
    try {
      const { items, hasMore } = await fetchMoreCatalog(page, { q: query, tag, genre, baseUrl });
      return responseJson(200, { items, page, hasMore });
    } catch {
      const target = new URL(`${baseUrl}/`);
      target.searchParams.set("q", query);
      if (page > 1) target.searchParams.set("page", String(page));
      const html = await fetchRealmHtml(target.toString());
      return responseJson(200, {
        items: parseRealmCatalog(html, baseUrl),
        page,
        hasMore: catalogHasMore(html, page),
      });
    }
  }

  if (requestUrl.pathname.endsWith("/follow-latest")) {
    const { novelId } = novelIdFromUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    const novelUrl = buildNovelUrl(novelId, baseUrl);
    const html = await fetchRealmHtml(novelUrl);
    return responseJson(200, parseRealmFollowLatest(html, novelId, baseUrl));
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const { novelId } = novelIdFromUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    const novelUrl = buildNovelUrl(novelId, baseUrl);
    const [html, skyChapters] = await Promise.all([
      fetchRealmHtml(novelUrl),
      fetchSkyNovelChapters(novelId).catch(() => null),
    ]);
    return responseJson(200, parseRealmDetails(html, novelId, baseUrl, skyChapters));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const { novelId, chapterNumber } = novelIdFromUrl(requestUrl.searchParams.get("url") ?? "", ctx);
    if (!chapterNumber || chapterNumber < 1) throw new Error("رابط فصل Realm Novel غير صالح");
    const url = buildChapterUrl(novelId, chapterNumber, baseUrl);
    if (chapterNumber > FREE_WEB_CHAPTERS) {
      return responseJson(200, await fetchSkyChapter(novelId, chapterNumber, url));
    }
    try {
      const html = await fetchRealmHtml(url);
      return responseJson(200, parseRealmChapter(html, url));
    } catch (webError) {
      try {
        return responseJson(200, await fetchSkyChapter(novelId, chapterNumber, url));
      } catch {
        throw webError;
      }
    }
  }

  return responseJson(404, { error: "Route Realm Novel inconnue" });
}
