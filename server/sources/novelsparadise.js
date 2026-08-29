import { decodeHtml, parseDetailTaxonomies, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import {
  applyRecentChapterFields,
  enrichCatalogItems,
  normalizeRecentChapters,
} from "../lib/catalogChapters.js";
import { createHostContext, resolveSourceRequestContext } from "../lib/sourceBaseUrl.js";
import { isNovelBoilerplateParagraph } from "../lib/novelChapterText.js";

const DEFAULT_BASE_URL = "https://novelsparadise.site";
const DEFAULT_CTX = createHostContext(DEFAULT_BASE_URL);
const SOURCE_NAME = "Novels Paradise";
const SOURCE_ID = "novelsparadise";

function createFetcher(baseUrl = DEFAULT_BASE_URL) {
  return createCachedHtmlFetcher({
    ttlMs: 3 * 60_000,
    timeoutMs: 35_000,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ar,en-US;q=0.9,en;q=0.8",
      referer: `${baseUrl}/`,
      "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "upgrade-insecure-requests": "1",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    getVariants: (url) => [url],
    buildError: (lastStatus) => (lastStatus === 403
      ? "حماية Novels Paradise تمنع الاتصال (Cloudflare)"
      : `Novels Paradise a répondu ${lastStatus}`),
  });
}

function assertParadiseHost(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("المصدر غير مسموح");
  }
  url.hostname = ctx.apex;
  url.hash = "";
  return url;
}

export function slugFromPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "series" && parts[1]) return parts[1];
  return parts[0] || "";
}

export function seriesSlugFromSlug(slug) {
  return slug.replace(/-\d+$/, "");
}

export function buildSeriesUrl(seriesSlug, baseUrl = DEFAULT_BASE_URL) {
  return `${baseUrl}/series/${seriesSlug}/`;
}

export function normalizeSeriesUrl(rawUrl) {
  const url = assertParadiseHost(rawUrl);
  const slug = slugFromPath(url.pathname);
  if (!slug) throw new Error("رابط Novels Paradise غير صالح");
  return buildSeriesUrl(seriesSlugFromSlug(slug));
}

export function normalizeChapterUrl(rawUrl) {
  const url = assertParadiseHost(rawUrl);
  const slug = slugFromPath(url.pathname);
  if (!slug || slug === "series") throw new Error("رابط فصل Novels Paradise غير صالح");
  if (!/-\d+$/.test(slug)) throw new Error("رابط فصل Novels Paradise غير صالح");
  return `${DEFAULT_BASE_URL}/${slug}/`;
}

export function isParadiseChapterSlug(slug) {
  return Boolean(slug) && slug !== "series" && /-\d+$/.test(slug);
}

export function resolveParadiseSeriesUrl(chapterUrl, seriesUrl = "") {
  if (seriesUrl) {
    try {
      return normalizeSeriesUrl(seriesUrl);
    } catch {
      // Fall back to chapter-derived series URL.
    }
  }
  return normalizeSeriesUrl(chapterUrl);
}

function assertParadiseImageUrl(rawUrl, ctx = DEFAULT_CTX) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ctx.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("رابط الصورة غير مسموح");
  }
  return url.toString();
}

function parseImageUrl(tag = "") {
  const dataLazy = tag.match(/data-lazy-src=["']([^"']+)["']/i)?.[1];
  const dataSrc = tag.match(/data-src=["']([^"']+)["']/i)?.[1];
  const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
  return decodeHtml(dataLazy || dataSrc || src || "");
}

export function hasArabicScript(text = "") {
  return /[\u0600-\u06FF]/.test(text);
}

export function cleanParadiseTitle(text = "", { stripNovelPrefix = false } = {}) {
  let cleaned = textOnly(text)
    .replace(/\*+/g, "")
    .replace(/^[“”"'\s]+|[“”"'\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripNovelPrefix) cleaned = cleaned.replace(/^رواية\s+/iu, "").trim();
  return cleaned;
}

export function resolveParadiseTitles(primary = "", alternate = "") {
  const a = cleanParadiseTitle(primary);
  const b = cleanParadiseTitle(alternate, { stripNovelPrefix: true });
  if (!b) return { title: a, altTitle: "" };
  if (!a) return { title: b, altTitle: "" };
  const aAr = hasArabicScript(a);
  const bAr = hasArabicScript(b);
  if (bAr && !aAr) return { title: b, altTitle: a };
  if (aAr && !bAr) return { title: a, altTitle: b };
  if (a !== b) return { title: a, altTitle: b };
  return { title: a, altTitle: "" };
}

function parseCatalogArabicTitleFromExcerpt(article = "") {
  const excerpt = textOnly(article.match(/class="[^"]*contexcerpt[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
  const matches = [...excerpt.matchAll(/رواية\s+((?:[\u0600-\u06FF][\u0600-\u06FF\s'’\-:،؛!؟.]*?))\s+مترجمة/giu)];
  if (!matches.length) return "";
  return matches.sort((a, b) => b[1].length - a[1].length)[0][1].trim();
}

function parseArticleTitleAndHref(article) {
  const headline = article.match(/<h2[^>]*itemprop=["']headline["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (headline) {
    return { href: decodeHtml(headline[1]), title: headline[2] };
  }
  const forward = article.match(/<a\b[^>]*title=["']([^"']+)["'][^>]*href=["']([^"']+)["']/i);
  if (forward) return { title: forward[1], href: forward[2] };
  const reverse = article.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/i);
  if (reverse) return { title: reverse[2], href: reverse[1] };
  return null;
}

function defaultExtractCatalogChapterNumber(text = "") {
  return textOnly(text).match(/(\d+(?:\.\d+)?)/)?.[1] ?? "—";
}

export function parseCatalogChaptersFromArticle(article, baseUrl = DEFAULT_BASE_URL, extractNumber = defaultExtractCatalogChapterNumber) {
  const chapters = [];
  for (const match of article.matchAll(/class="[^"]*nchapter[^"]*"[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const chapterUrl = new URL(decodeHtml(match[1]), baseUrl).toString();
    const number = extractNumber(match[2], "", "—");
    if (!chapterUrl || number === "—") continue;
    chapters.push({ number, name: number, url: chapterUrl });
  }
  return applyRecentChapterFields(
    { latestChapter: "—", latestChapterUrl: null, recentChapters: [] },
    normalizeRecentChapters(chapters),
  );
}

function parseCatalogChapterFromArticle(article) {
  return parseCatalogChaptersFromArticle(article);
}

export async function enrichParadiseCatalogItems(items, fetchHtml, parseChapters) {
  return enrichCatalogItems(items, {
    enrichItem: async (item) => {
      const html = await fetchHtml(item.url);
      const chapters = parseChapters(html, item.url);
      return normalizeRecentChapters(
        chapters.map((chapter) => ({
          number: chapter.number,
          name: chapter.name || chapter.number,
          url: chapter.url,
        })),
      );
    },
  });
}

export const PARADISE_CATALOG_PAGE_SIZE = 20;

export function catalogHasMorePages(html, page = 1, pageSize = PARADISE_CATALOG_PAGE_SIZE) {
  if (!html) return false;
  if (/<link\b[^>]*rel=["']next["']/i.test(html)) return true;

  const pageFromHref = (href = "") => {
    const match = href.match(/[?&]page=(\d+)/i);
    return match ? Number(match[1]) : 0;
  };

  const hpageBlock = html.match(/<div[^>]*class="[^"]*hpage[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  if (hpageBlock) {
    const linkedPages = [...hpageBlock.matchAll(/[?&]page=(\d+)/gi)].map((match) => Number(match[1]));
    const maxLinkedPage = linkedPages.reduce((max, value) => Math.max(max, value), 0);
    if (maxLinkedPage > page) return true;

    const nextLinks = [...hpageBlock.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?Next/gi)];
    for (const match of nextLinks) {
      const linkedPage = pageFromHref(match[1]);
      if (linkedPage > page) return true;
    }
  }

  const nextClassLinks = [...html.matchAll(/<a\b[^>]*class="[^"]*next[^"]*"[^>]*href=["']([^"']+)["']/gi)];
  for (const match of nextClassLinks) {
    const linkedPage = pageFromHref(match[1]);
    if (!linkedPage || linkedPage > page) return true;
  }

  const itemCount = (html.match(/<article\b/gi) || []).length;
  return itemCount >= pageSize;
}

function extractParadiseFiltersForm(html = "") {
  return html.match(/<form[^>]*class=["'][^"']*filters[^"']*["'][^>]*>[\s\S]*?<\/form>/i)?.[0] ?? "";
}

function decodeParadiseFilterValue(raw = "") {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return decodeHtml(raw);
  }
}

export function parseParadiseFilterCheckboxes(html, fieldName) {
  const form = extractParadiseFiltersForm(html);
  const entries = [];
  const seen = new Set();
  const pattern = new RegExp(
    `<li>\\s*<input\\b[^>]*\\bname=["']${fieldName}\\[\\]["'][^>]*\\bvalue=["']([^"']*)["'][^>]*>\\s*<label\\b[^>]*>([\\s\\S]*?)<\\/label>\\s*<\\/li>`,
    "gi",
  );
  for (const match of form.matchAll(pattern)) {
    const slug = decodeParadiseFilterValue(match[1]);
    const name = textOnly(match[2]);
    const key = slug.toLocaleLowerCase("ar");
    if (!slug || !name || seen.has(key)) continue;
    seen.add(key);
    entries.push({ slug, name, count: 0 });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export function parseParadiseFilters(html) {
  return {
    categories: parseParadiseFilterCheckboxes(html, "genre"),
    tags: parseParadiseFilterCheckboxes(html, "type"),
  };
}

function assertParadiseFilterSlug(value, label) {
  const slug = value?.trim() ?? "";
  if (!slug) return "";
  if (!/^[\p{L}\p{N}+_.-]+$/u.test(slug)) throw new Error(`${label} Novels Paradise غير صالح`);
  return slug;
}

function buildParadiseCatalogUrl(page, { status = "", order = "latest", genre = "", tag = "" } = {}, baseUrl = DEFAULT_BASE_URL) {
  const query = new URL(`${baseUrl}/series/`);
  query.searchParams.set("page", String(page));
  query.searchParams.set("status", status);
  query.searchParams.set("order", order);
  if (genre) query.searchParams.append("genre[]", genre);
  if (tag) query.searchParams.append("type[]", tag);
  return query.toString();
}

function mapCatalogItem(rawTitle, href, cover, article = "") {
  const slug = seriesSlugFromSlug(slugFromPath(new URL(href, DEFAULT_BASE_URL).pathname));
  const alter = article.match(/<span class="alter">([\s\S]*?)<\/span>/i)?.[1] ?? "";
  const excerptTitle = parseCatalogArabicTitleFromExcerpt(article);
  const { title, altTitle } = resolveParadiseTitles(rawTitle, alter || excerptTitle);
  return {
    id: slug,
    title,
    altTitle,
    url: buildSeriesUrl(slug),
    cover: decodeHtml(cover),
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    ...parseCatalogChapterFromArticle(article),
  };
}

export function parseParadiseCatalog(html) {
  const results = [];
  const seen = new Set();
  const articlePattern = /<article\b[\s\S]*?<\/article>/gi;
  for (const block of html.matchAll(articlePattern)) {
    const article = block[0];
    const link = parseArticleTitleAndHref(article);
    if (!link?.href || !link.title) continue;
    const imageTag = article.match(/<img\b[^>]*class="[^"]*ts-post-image[^"]*"[^>]*>/i)?.[0]
      ?? article.match(/<img\b[^>]*>/i)?.[0]
      ?? "";
    const cover = parseImageUrl(imageTag);
    const item = mapCatalogItem(link.title, link.href, cover, article);
    if (!item.title || !item.url.includes("/series/") || seen.has(item.id)) continue;
    seen.add(item.id);
    results.push(item);
  }
  return results;
}

export function extractEplisterListBlocks(html) {
  const pattern = /<div[^>]*class="[^"]*\beplister\b[^"]*"[^>]*>[\s\S]*?<ul\b[^>]*>([\s\S]*?)<\/ul>/gi;
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

export function parseParadiseChapters(html, seriesUrl) {
  const chapters = [];
  const seen = new Set();
  const eplisterBlocks = extractEplisterListBlocks(html);
  if (!eplisterBlocks.length) {
    return chapters;
  }
  for (const eplisterBlock of eplisterBlocks) {
    for (const match of eplisterBlock.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const block = match[1];
    const link = block.match(/<a\b[^>]*href=["']([^"']+)["']/i);
    if (!link) continue;
    const chapterUrl = decodeHtml(link[1]);
    const chapterSlug = slugFromPath(new URL(chapterUrl, DEFAULT_BASE_URL).pathname);
    if (!isParadiseChapterSlug(chapterSlug)) continue;
    if (seen.has(chapterUrl)) continue;
    seen.add(chapterUrl);
    const eplNum = textOnly(block.match(/class="[^"]*epl-num[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
    const eplTitle = textOnly(block.match(/class="[^"]*epl-title[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
    const date = textOnly(block.match(/class="[^"]*epl-date[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
    const locked = /fa-lock|🔒|مدفوع/i.test(block);
    const number = (eplNum.match(/(\d+(?:\.\d+)?)/) || eplTitle.match(/(\d+(?:\.\d+)?)/) || [])[1]
      || String(chapters.length + 1);
    const name = eplTitle || eplNum || number;
    chapters.push({
      url: new URL(chapterUrl, DEFAULT_BASE_URL).toString(),
      name: locked ? `🔒 ${name}` : name,
      number,
      date,
      locked,
    });
    }
  }
  chapters.reverse();
  return chapters;
}

const PARADISE_BROWSER_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "ar,en-US;q=0.9,en;q=0.8",
  "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "upgrade-insecure-requests": "1",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

async function fetchParadiseChapterHtml(chapterUrl, seriesUrl = "", ctx = DEFAULT_CTX) {
  const refererSeriesUrl = resolveParadiseSeriesUrl(chapterUrl, seriesUrl);
  const headers = {
    ...PARADISE_BROWSER_HEADERS,
    referer: refererSeriesUrl,
  };
  await fetch(refererSeriesUrl, {
    headers: { ...PARADISE_BROWSER_HEADERS, referer: `${ctx.baseUrl}/series/` },
    redirect: "follow",
    signal: AbortSignal.timeout(35_000),
  }).catch(() => {});
  const response = await fetch(chapterUrl, {
    redirect: "follow",
    headers,
    signal: AbortSignal.timeout(35_000),
  });
  const html = await response.text();
  if (response.status === 403 || /Just a moment|cf-chl-|challenges\.cloudflare\.com/i.test(html)) {
    throw new Error("حماية Novels Paradise تمنع قراءة الفصول (Cloudflare)");
  }
  if (!response.ok) throw new Error(`Novels Paradise a répondu ${response.status}`);
  return html;
}

function parseParadiseDetails(html, url) {
  const primaryTitle = textOnly(
    html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]?.split(" - ")?.[0]
    ?? "",
  );
  const alternateTitle = textOnly(html.match(/<span class="alter">([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const { title, altTitle } = resolveParadiseTitles(primaryTitle, alternateTitle);
  const coverTag = html.match(/<(?:div[^>]*class="[^"]*(?:thumb|thumbook)[^"]*"[^>]*>[\s\S]*?)<img\b[^>]*>/i)?.[0]
    ?? html.match(/<img\b[^>]*class="[^"]*ts-post-image[^"]*"[^>]*>/i)?.[0]
    ?? "";
  const cover = parseImageUrl(coverTag)
    || decodeHtml(html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? "");
  const summary = textOnly(
    html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
    ?? html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]
    ?? "",
  );
  const chapters = parseParadiseChapters(html, url);
  const taxonomies = parseDetailTaxonomies(html, DEFAULT_BASE_URL);
  const seriesSlug = seriesSlugFromSlug(slugFromPath(new URL(url).pathname));
  return {
    id: seriesSlug,
    title,
    altTitle,
    cover,
    summary,
    url,
    source: SOURCE_NAME,
    sourceId: SOURCE_ID,
    mediaType: "novel",
    mediaTypeLabel: "رواية",
    ...taxonomies,
    chapters,
  };
}

const PARADISE_PAYWALL_RE = /تفعيل JavaScript|unlock|اشترك/i;
const SCRAMBLED_PARAGRAPH_RATIO = 0.32;
const KOLNOVEL_HASH_PARAGRAPH_RE = /<p class='[a-f0-9]{16,}'[^>]*>[\s\S]*?<p class="[a-f0-9]{16,}"/i;
const PARADISE_JUNK_PARAGRAPH_RE = /\.shola-|function\s+sholaTab|#366ad3|wp-admin\/admin-ajax|chapter-countdown/i;

function isParadiseParagraphText(text) {
  return Boolean(
    text
    && text.length > 1
    && !PARADISE_PAYWALL_RE.test(text)
    && !PARADISE_JUNK_PARAGRAPH_RE.test(text)
    && !isNovelBoilerplateParagraph(text),
  );
}

function sanitizeParadiseContentBlock(htmlBlock = "") {
  return htmlBlock
    .replace(/<div[^>]*class="[^"]*\bshola[\s\S]*$/i, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
}

function isKolnovelHashParagraphMode(htmlBlock = "") {
  return KOLNOVEL_HASH_PARAGRAPH_RE.test(htmlBlock);
}

function dedupeConsecutiveParagraphs(paragraphs = []) {
  return paragraphs.filter((paragraph, index) => index === 0 || paragraph !== paragraphs[index - 1]);
}

export function extractBalancedDivInnerHtml(html, classPattern) {
  const startMatch = html.match(classPattern);
  if (!startMatch) return "";
  const start = startMatch.index + startMatch[0].length;
  let depth = 1;
  let index = start;
  while (index < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", index);
    const nextClose = html.indexOf("</div>", index);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      index = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) return html.slice(start, nextClose);
      index = nextClose + 6;
    }
  }
  return html.slice(start);
}

function extractLeafParagraphs(htmlBlock = "") {
  return [...htmlBlock.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => textOnly(match[1]))
    .filter(isParadiseParagraphText);
}

function extractOuterParagraphUnits(htmlBlock = "") {
  const paragraphs = [];
  const outerRe = /<p class='[^']+'/gi;
  const indices = [];
  let match;
  while ((match = outerRe.exec(htmlBlock))) indices.push(match.index);
  for (let index = 0; index < indices.length; index += 1) {
    const chunk = htmlBlock.slice(indices[index], indices[index + 1] ?? htmlBlock.length);
    const text = textOnly(chunk);
    if (isParadiseParagraphText(text)) paragraphs.push(text);
  }
  return paragraphs;
}

function extractOuterDirectParagraphs(htmlBlock = "") {
  const paragraphs = [];
  const outerRe = /<p class='[^']+'[^>]*>/gi;
  let match;
  while ((match = outerRe.exec(htmlBlock))) {
    const rest = htmlBlock.slice(match.index + match[0].length);
    const nestedIdx = rest.search(/<p\b/i);
    const untilClose = rest.search(/<\/p>/i);
    const boundary = nestedIdx >= 0 && (untilClose < 0 || nestedIdx < untilClose) ? nestedIdx : untilClose;
    const chunk = boundary >= 0 ? rest.slice(0, boundary) : rest;
    const text = textOnly(chunk);
    if (isParadiseParagraphText(text)) paragraphs.push(text);
  }
  return paragraphs;
}

function shouldUseScrambledParagraphMode(htmlBlock = "") {
  const outerRe = /<p class='[^']+'/gi;
  const indices = [];
  let match;
  while ((match = outerRe.exec(htmlBlock))) indices.push(match.index);
  if (indices.length < 4) return false;

  let scrambled = 0;
  for (let index = 0; index < indices.length; index += 1) {
    const chunk = htmlBlock.slice(indices[index], indices[index + 1] ?? htmlBlock.length);
    const open = chunk.match(/^<p class='[^']+'[^>]*>/i)?.[0] ?? "";
    const rest = chunk.slice(open.length);
    const nestedIdx = rest.search(/<p class="/i);
    if (nestedIdx < 0) continue;
    const direct = textOnly(rest.slice(0, nestedIdx));
    const inner = textOnly(rest.slice(nestedIdx).match(/<p class="[^"]+">([\s\S]*?)<\/p>/i)?.[1] ?? "");
    if (direct.length < 50 && inner.length > 30 && !inner.includes(direct) && !direct.includes(inner)) {
      scrambled += 1;
    }
  }
  return scrambled / indices.length >= SCRAMBLED_PARAGRAPH_RATIO;
}

export function extractParadiseParagraphs(htmlBlock = "") {
  const cleanedBlock = sanitizeParadiseContentBlock(htmlBlock);
  if (!cleanedBlock) return [];

  const blockquoteParagraphs = [...cleanedBlock.matchAll(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi)]
    .flatMap((match) => extractLeafParagraphs(match[1]))
    .filter(isParadiseParagraphText);

  const hasNestedOuterParagraphs = /<p class='[^']+'/i.test(cleanedBlock);
  if (hasNestedOuterParagraphs) {
    const paragraphs = (isKolnovelHashParagraphMode(cleanedBlock) || shouldUseScrambledParagraphMode(cleanedBlock))
      ? extractOuterDirectParagraphs(cleanedBlock)
      : extractOuterParagraphUnits(cleanedBlock);
    if (paragraphs.length) {
      return dedupeConsecutiveParagraphs([...blockquoteParagraphs, ...paragraphs]);
    }
  }

  const leafParagraphs = extractLeafParagraphs(cleanedBlock);
  if (leafParagraphs.length) return dedupeConsecutiveParagraphs(leafParagraphs);
  return dedupeConsecutiveParagraphs(blockquoteParagraphs);
}

export function parseParadiseChapter(html, url) {
  const title = textOnly(
    html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
    ?? "",
  );

  const epcontentPattern = /<div[^>]*class="[^"]*epcontent[^"]*entry-content[^"]*"[^>]*>/i;
  let bestBlock = extractBalancedDivInnerHtml(html, epcontentPattern);
  let bestLength = textOnly(bestBlock).length;

  if (bestLength < 100) {
    const shallowBlocks = [...html.matchAll(/<div[^>]*class="[^"]*epcontent[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
    shallowBlocks.forEach((match) => {
      const length = textOnly(match[1]).length;
      if (length > bestLength) {
        bestLength = length;
        bestBlock = match[1];
      }
    });
  }

  const fallbackSelectors = [
    /<div[^>]*id=["']chapter-content["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*reading-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*chapter-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];
  if (bestLength < 100) {
    for (const pattern of fallbackSelectors) {
      const match = html.match(pattern);
      if (match && textOnly(match[1]).length > bestLength) {
        bestBlock = match[1];
        bestLength = textOnly(bestBlock).length;
      }
    }
  }

  const paragraphs = extractParadiseParagraphs(bestBlock);

  return {
    title: title || "فصل",
    url,
    kind: "novel",
    paragraphs,
    pages: [],
  };
}

export async function handleNovelsParadiseRequest(requestUrl) {
  const ctx = resolveSourceRequestContext(requestUrl, DEFAULT_BASE_URL, { label: SOURCE_NAME });
  const fetchParadiseHtml = createFetcher(ctx.baseUrl);

  if (requestUrl.pathname.endsWith("/image")) {
    return fetchProxiedImage(assertParadiseImageUrl(requestUrl.searchParams.get("url") ?? "", ctx), `${ctx.baseUrl}/`, SOURCE_NAME);
  }
  if (requestUrl.pathname.endsWith("/filters")) {
    const html = await fetchParadiseHtml(buildParadiseCatalogUrl(1, {}, ctx.baseUrl));
    return responseJson(200, { ...parseParadiseFilters(html), fetchedAt: new Date().toISOString() });
  }
  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const order = requestUrl.searchParams.get("order")?.trim() || "latest";
    const genre = assertParadiseFilterSlug(requestUrl.searchParams.get("genre"), "تصنيف");
    const tag = assertParadiseFilterSlug(requestUrl.searchParams.get("tag"), "وسم");
    const html = await fetchParadiseHtml(buildParadiseCatalogUrl(page, {
      status: requestUrl.searchParams.get("status") ?? "",
      order,
      genre,
      tag,
    }, ctx.baseUrl));
    const items = parseParadiseCatalog(html);
    return responseJson(200, {
      items,
      page,
      genre,
      tag,
      hasMore: catalogHasMorePages(html, page),
      fetchedAt: new Date().toISOString(),
    });
  }
  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = assertParadiseFilterSlug(requestUrl.searchParams.get("genre"), "تصنيف");
    const tag = assertParadiseFilterSlug(requestUrl.searchParams.get("tag"), "وسم");
    const target = new URL(`${ctx.baseUrl}/series/`);
    target.searchParams.set("page", String(page));
    target.searchParams.set("s", query);
    if (genre) target.searchParams.append("genre[]", genre);
    if (tag) target.searchParams.append("type[]", tag);
    const html = await fetchParadiseHtml(target.toString());
    return responseJson(200, { items: parseParadiseCatalog(html), page, hasMore: catalogHasMorePages(html, page) });
  }
  if (requestUrl.pathname.endsWith("/manga")) {
    const target = normalizeSeriesUrl(requestUrl.searchParams.get("url") ?? "");
    const html = await fetchParadiseHtml(target);
    return responseJson(200, parseParadiseDetails(html, target));
  }
  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = normalizeChapterUrl(requestUrl.searchParams.get("url") ?? "");
    const seriesUrl = requestUrl.searchParams.get("series") ?? "";
    const html = await fetchParadiseChapterHtml(target, seriesUrl, ctx);
    return responseJson(200, parseParadiseChapter(html, target));
  }
  return responseJson(404, { error: "Route Novels Paradise inconnue" });
}
