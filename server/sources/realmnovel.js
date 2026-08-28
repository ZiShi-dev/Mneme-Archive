import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { fetchSkyChapter } from "../lib/skynovelApi.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, recentChaptersFromCount } from "../lib/catalogChapters.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";

const BASE_URL = "https://realmnovel.com";
const SOURCE_NAME = "Realm Novel";
const SOURCE_ID = "realmnovel";
const FREE_WEB_CHAPTERS = 50;
const CATALOG_PAGE_SIZE = 24;

const fetchRealmHtml = createCachedHtmlFetcher({
  ttlMs: 3 * 60_000,
  timeoutMs: 35_000,
  headers: {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "ar,en;q=0.8",
    referer: `${BASE_URL}/`,
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  },
  getVariants: (url) => [url],
  buildError: (lastStatus) => `Realm Novel a répondu ${lastStatus || "sans réponse"}`,
});

async function fetchRealmJson(path, { searchParams = {} } = {}) {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "accept-language": "ar,en;q=0.8",
      referer: `${BASE_URL}/`,
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

function mapRealmCatalogChapters(novelId, totalChapters) {
  return recentChaptersFromCount(totalChapters, (number) => buildChapterUrl(novelId, number));
}

function mapMoreCatalogDoc(entry = {}) {
  const novelId = entry.id;
  if (!novelId || !entry.title) return null;
  const totalChapters = Number(entry.chapters) || 0;
  const recentChapters = mapRealmCatalogChapters(novelId, totalChapters);
  return applyRecentChapterFields({
    id: novelId,
    title: entry.title,
    altTitle: entry.titleEn || "",
    url: buildNovelUrl(novelId),
    cover: `${BASE_URL}/img/novel/${novelId}.jpg`,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
  }, recentChapters);
}

export function parseRealmMoreCatalog(data) {
  const docs = Array.isArray(data?.docs) ? data.docs : [];
  return docs.map(mapMoreCatalogDoc).filter(Boolean);
}

async function fetchMoreCatalog(page, { q = "", tag = "" } = {}) {
  const data = await fetchRealmJson("/_more", {
    searchParams: {
      page: String(page),
      q,
      tag,
    },
  });
  const items = parseRealmMoreCatalog(data);
  return {
    items,
    hasMore: Boolean(data?.hasMore) && items.length > 0,
  };
}

function assertRealmHost(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !["realmnovel.com", "www.realmnovel.com"].includes(url.hostname)) {
    throw new Error("المصدر غير مسموح");
  }
  url.hostname = "realmnovel.com";
  url.hash = "";
  return url;
}

function assertRealmImageUrl(rawUrl) {
  const url = assertRealmHost(rawUrl);
  if (!url.pathname.startsWith("/img/novel/")) throw new Error("رابط الصورة غير مسموح");
  return url.toString();
}

function buildNovelUrl(novelId) {
  return `${BASE_URL}/novel/${novelId}`;
}

function buildChapterUrl(novelId, chapterNumber) {
  return `${BASE_URL}/novel/${novelId}/chapter/${chapterNumber}`;
}

export function novelIdFromUrl(rawUrl) {
  const url = assertRealmHost(rawUrl);
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

function parseCatalogCard(block = "") {
  const href = block.match(/href="(\/novel\/[a-f0-9]{24})"/i)?.[1];
  if (!href) return null;
  const novelId = href.split("/").pop();
  const title = decodeHtml(block.match(/class="g3title"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
  const altTitle = decodeHtml(block.match(/class="g3sub"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
  const favBtn = block.match(/data-fav-btn[^>]*data-chapters="(\d+)"/i);
  const chapsText = block.match(/class="g3chaps"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "";
  const totalChapters = favBtn ? Number(favBtn[1]) : parseTotalChapters(chapsText);
  const coverPath = block.match(/src="(\/img\/novel\/[^"]+)"/i)?.[1] ?? `/img/novel/${novelId}.jpg`;
  const recentChapters = mapRealmCatalogChapters(novelId, totalChapters);
  return applyRecentChapterFields({
    id: novelId,
    title,
    altTitle,
    url: buildNovelUrl(novelId),
    cover: `${BASE_URL}${coverPath}`,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
  }, recentChapters);
}

export function parseRealmCatalog(html) {
  const results = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a class="g3card"[\s\S]*?<\/a>/gi)) {
    const item = parseCatalogCard(match[0]);
    if (!item?.title || seen.has(item.id)) continue;
    seen.add(item.id);
    results.push(item);
  }
  return results;
}

function parseNovelHead(html, novelId) {
  const title = textOnly(html.match(/<article class="novel-head"[\s\S]*?<h1 class="h1">([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const altTitle = textOnly(html.match(/<article class="novel-head"[\s\S]*?<h2 class="sub">([\s\S]*?)<\/h2>/i)?.[1] ?? "");
  const altTitle2 = textOnly(html.match(/<article class="novel-head"[\s\S]*?<p class="sub">([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const coverPath = html.match(/<article class="novel-head"[\s\S]*?<img[^>]*src="(\/img\/novel\/[^"]+)"/i)?.[1]
    ?? `/img/novel/${novelId}.jpg`;
  const summary = textOnly(html.match(/<article class="novel-head"[\s\S]*?<p class="desc">([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const badges = [...html.matchAll(/<article class="novel-head"[\s\S]*?<span class="badge">([\s\S]*?)<\/span>/gi)]
    .map((entry) => textOnly(entry[1]))
    .filter(Boolean);
  const favChapters = html.match(/<article class="novel-head"[\s\S]*?data-chapters="(\d+)"/i)?.[1];
  const totalChapters = favChapters ? Number(favChapters) : parseTotalChapters(badges.join(" "));
  const tags = [...html.matchAll(/<article class="novel-head"[\s\S]*?<a class="tag"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((entry) => textOnly(entry[1]))
    .filter(Boolean);
  return {
    title,
    altTitle: altTitle || altTitle2,
    cover: `${BASE_URL}${coverPath}`,
    summary,
    totalChapters,
    tags,
    categories: badges.filter((badge) => !/^\d+\s*فصل$/u.test(badge) && !/^(مستمرة|مكتملة|مترجمة|مؤلفة)$/u.test(badge)),
  };
}

function parseChapterRows(html, novelId) {
  const chapters = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a class="chapter-row([^"]*)"[^>]*href="\/novel\/[a-f0-9]{24}\/chapter\/(\d+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const extraClass = match[1] || "";
    const number = match[2];
    if (seen.has(number)) continue;
    seen.add(number);
    const label = textOnly(match[3]);
    const locked = extraClass.includes("is-locked") || Number(number) > FREE_WEB_CHAPTERS;
    chapters.push({
      url: buildChapterUrl(novelId, number),
      name: label || number,
      number,
      date: "",
      locked,
    });
  }
  return chapters;
}

function extendChapterList(chapters, totalChapters, novelId) {
  if (!totalChapters || totalChapters <= chapters.length) return chapters;
  const seen = new Set(chapters.map((chapter) => chapter.number));
  const extended = [...chapters];
  for (let n = 1; n <= totalChapters; n += 1) {
    const key = String(n);
    if (seen.has(key)) continue;
    extended.push({
      url: buildChapterUrl(novelId, n),
      name: key,
      number: key,
      date: "",
      locked: n > FREE_WEB_CHAPTERS,
    });
  }
  return extended.sort((a, b) => Number(a.number) - Number(b.number));
}

export function parseRealmDetails(html, novelId) {
  const head = parseNovelHead(html, novelId);
  const chapters = extendChapterList(parseChapterRows(html, novelId), head.totalChapters, novelId);
  const statusBadges = [...html.matchAll(/<article class="novel-head"[\s\S]*?<span class="badge">([\s\S]*?)<\/span>/gi)]
    .map((entry) => textOnly(entry[1]))
    .filter(Boolean);
  return enrichSourceDetails({
    id: novelId,
    title: head.title,
    altTitle: head.altTitle,
    cover: head.cover,
    summary: head.summary,
    url: buildNovelUrl(novelId),
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

export function parseRealmChapter(html, url) {
  if (html.includes('class="locked"') || /غير متاح على الموقع/i.test(html)) {
    throw new Error("هذا الفصل متاح داخل تطبيق Sky Novel فقط (مجاني)");
  }
  const block = html.match(/<div class="chapter-content">([\s\S]*?)<\/div>/i)?.[1] ?? "";
  const title = textOnly(html.match(/<h1 class="h1"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "فصل");
  const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => textOnly(match[1]))
    .filter((text) => text && text.length > 1);
  if (!paragraphs.length) throw new Error("تعذر استخراج محتوى الفصل");
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

function buildCatalogUrl(page, { genre = "", tag = "" } = {}) {
  const query = new URL(`${BASE_URL}/`);
  if (page > 1) query.searchParams.set("page", String(page));
  if (tag) query.searchParams.set("tag", tag);
  if (genre && !tag) query.searchParams.set("tag", genre);
  return query.toString();
}

async function collectFilterTags() {
  const html = await fetchRealmHtml(buildCatalogUrl(1));
  const firstId = html.match(/href="\/novel\/([a-f0-9]{24})"/i)?.[1];
  if (!firstId) return { categories: [], tags: [] };
  const detailsHtml = await fetchRealmHtml(buildNovelUrl(firstId));
  const head = parseNovelHead(detailsHtml, firstId);
  const tags = head.tags.map((name) => ({ slug: name, name, count: 0 }));
  const categories = head.categories.map((name) => ({ slug: name, name, count: 0 }));
  return { categories, tags };
}

export async function handleRealmNovelRequest(requestUrl) {
  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(assertRealmImageUrl(requestUrl.searchParams.get("url") ?? ""), `${BASE_URL}/`, SOURCE_NAME);
  }

  if (requestUrl.pathname.endsWith("/filters")) {
    const filters = await collectFilterTags();
    return responseJson(200, { ...filters, fetchedAt: new Date().toISOString() });
  }

  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() || "";
    const tag = requestUrl.searchParams.get("tag")?.trim() || genre;
    try {
      const { items, hasMore } = await fetchMoreCatalog(page, { tag });
      return responseJson(200, {
        items,
        page,
        genre,
        tag,
        hasMore,
        fetchedAt: new Date().toISOString(),
      });
    } catch {
      const html = await fetchRealmHtml(buildCatalogUrl(page, { genre, tag }));
      const items = parseRealmCatalog(html);
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
    try {
      const { items, hasMore } = await fetchMoreCatalog(page, { q: query });
      return responseJson(200, { items, page, hasMore });
    } catch {
      const target = new URL(`${BASE_URL}/`);
      target.searchParams.set("q", query);
      if (page > 1) target.searchParams.set("page", String(page));
      const html = await fetchRealmHtml(target.toString());
      return responseJson(200, {
        items: parseRealmCatalog(html),
        page,
        hasMore: catalogHasMore(html, page),
      });
    }
  }

  if (requestUrl.pathname.endsWith("/manga")) {
    const { novelId } = novelIdFromUrl(requestUrl.searchParams.get("url") ?? "");
    const html = await fetchRealmHtml(buildNovelUrl(novelId));
    return responseJson(200, parseRealmDetails(html, novelId));
  }

  if (requestUrl.pathname.endsWith("/chapter")) {
    const { novelId, chapterNumber } = novelIdFromUrl(requestUrl.searchParams.get("url") ?? "");
    if (!chapterNumber || chapterNumber < 1) throw new Error("رابط فصل Realm Novel غير صالح");
    const url = buildChapterUrl(novelId, chapterNumber);
    if (chapterNumber > FREE_WEB_CHAPTERS) {
      try {
        return responseJson(200, await fetchSkyChapter(novelId, chapterNumber, url));
      } catch (skyError) {
        throw new Error(
          skyError?.message?.includes("تحديث")
            ? skyError.message
            : `الفصول بعد 50 (Sky Novel API): ${skyError?.message || "فشل الاتصال"}`,
        );
      }
    }
    const html = await fetchRealmHtml(url);
    return responseJson(200, parseRealmChapter(html, url));
  }

  return responseJson(404, { error: "Route Realm Novel inconnue" });
}
