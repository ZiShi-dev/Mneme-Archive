import { decodeHtml, mergeFilterGroups, parseDetailTaxonomies, parseTaxonomyFilterLinks, textOnly } from "../lib/htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "../lib/httpUtils.js";
import { normalizeSearchQuery } from "../lib/queryLimits.js";
import { responseJson } from "../lib/response.js";
import { applyRecentChapterFields, normalizeRecentChapters } from "../lib/catalogChapters.js";

const AZORA_URL = "https://azorafly.com";
const AZORA_API_URL = "https://api.azorafly.com";

let nativeHtmlFetcher = null;
let nativeImageFetcher = null;

export function configureAzoraflyNativeFetch({ fetchHtml, fetchImage } = {}) {
  nativeHtmlFetcher = fetchHtml ?? null;
  nativeImageFetcher = fetchImage ?? null;
}

const fetchAzoraHtmlRemote = createCachedHtmlFetcher({
  ttlMs: 3 * 60_000,
  timeoutMs: 30_000,
  headers: { accept: "text/html,application/xhtml+xml", "accept-language": "ar,en;q=0.9", "user-agent": "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36 Chrome/124 Safari/537.36" },
  getVariants: (url) => [url],
  buildError: (lastStatus) => (lastStatus === 403 ? "حماية AzoraFly منعت الاتصال مؤقتًا" : `AzoraFly a répondu ${lastStatus}`),
});

async function resolveAzoraHtml(url) {
  if (nativeHtmlFetcher) return nativeHtmlFetcher(url);
  return fetchAzoraHtmlRemote(url);
}

function assertAzoraUrl(rawUrl, chapter = false) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.hostname !== "azorafly.com") throw new Error("المصدر غير مسموح");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "series" || parts.length < (chapter ? 3 : 2)) throw new Error("رابط AzoraFly غير صالح");
  return url.toString();
}

function assertAzoraImageUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.hostname !== "storage.azorafly.com") throw new Error("رابط الصورة غير مسموح");
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (url.pathname.includes("..")) throw new Error("رابط الصورة غير مسموح");
  const allowedPath = url.pathname.startsWith("/upload/")
    || url.pathname.startsWith("/public/upload/")
    || /\.(?:webp|jpe?g|png|avif|gif)$/i.test(url.pathname);
  if (!allowedPath) throw new Error("رابط الصورة غير مسموح");
  return url.toString();
}

async function proxyAzoraImage(rawUrl) {
  const target = assertAzoraImageUrl(rawUrl);
  if (nativeImageFetcher) return nativeImageFetcher(target);
  return fetchProxiedImage(target, `${AZORA_URL}/`, "AzoraFly");
}

function parseAzoraFilters(html) {
  const categories = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (!/itemprop\s*=\s*["']genre["']/i.test(match[1])) continue;
    const href = decodeHtml(match[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    let genre = "";
    try { genre = new URL(href, AZORA_URL).searchParams.get("genres")?.replace(/^\+/, "") ?? ""; } catch { continue; }
    const name = textOnly(match[2]);
    if (!genre || !name || seen.has(genre)) continue;
    seen.add(genre);
    categories.push({ slug: genre, name, count: 0 });
  }
  return { categories, tags: [] };
}

function parseAzoraCatalog(html) {
  const results = [];
  const seen = new Set();
  const marker = /<div><div class="relative h-full p-1 sm:p-2 flex gap-2 sm:gap-4 rounded-xl border bg-card/gi;
  const starts = [...html.matchAll(marker)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const link = block.match(/<a href="\/series\/([^"\/?#]+)"[^>]*title="([^"]+)"/i);
    if (!link || seen.has(link[1])) return;
    const slug = link[1];
    const title = decodeHtml(link[2]);
    const cover = block.match(/<img[^>]*alt="[^"]*"[^>]*src="(https:\/\/storage\.azorafly\.com[^"]+)"/i)?.[1] ?? "";
    const mediaType = textOnly(block.match(/text-white[^>]*>([^<]+)<\/span>/i)?.[1] ?? "مانهوا");
    const chapterPattern = new RegExp(`<a href="\\/series\\/${slug}\\/([^\"]+)"[\\s\\S]*?<span>([^<]*الفصل[^<]*)<\\/span>`, "gi");
    const chapters = normalizeRecentChapters([...block.matchAll(chapterPattern)].map((entry) => {
      const name = textOnly(entry[2]).replace(/^الفصل\s*/i, "");
      return { url: `${AZORA_URL}/series/${slug}/${entry[1]}`, name, number: name };
    }));
    seen.add(slug);
    results.push(applyRecentChapterFields({ id: slug, title, url: `${AZORA_URL}/series/${slug}`, cover, source: "AzoraFly", sourceId: "azorafly", mediaType: /رواية/.test(mediaType) ? "novel" : "manga", mediaTypeLabel: mediaType || "مانهوا" }, chapters));
  });
  return results;
}

function extractAzoraPostId(html, slug) {
  const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`&quot;post&quot;:\\[0,\\{&quot;id&quot;:\\[0,(\\d+)\\],&quot;slug&quot;:\\[0,&quot;${escapedSlug}&quot;`, "i"),
    new RegExp(`"post":\\[0,\\{"id":\\[0,(\\d+)\\],"slug":\\[0,"${escapedSlug}"`, "i"),
    /&quot;id&quot;:\[0,(\d+)\],&quot;slug&quot;:\[0,&quot;([^&]+)&quot;/gi,
  ];

  for (const pattern of patterns.slice(0, 2)) {
    const match = html.match(pattern)?.[1];
    if (match) return Number(match);
  }

  for (const match of html.matchAll(patterns[2])) {
    if (match[2] === slug) return Number(match[1]);
  }

  return 0;
}

function mapAzoraChapter(slug, chapter) {
  return {
    url: `${AZORA_URL}/series/${slug}/${chapter.slug}`,
    name: `${chapter.number}${chapter.title ? ` · ${chapter.title}` : ""}`,
    number: String(chapter.number),
    date: chapter.createdAt ? new Date(chapter.createdAt).toLocaleDateString("ar-EG") : "",
    publishedAt: chapter.createdAt || null,
    locked: chapter.isAccessible === false,
    chapterId: chapter.id,
    price: chapter.price || 0,
    permanentlyLocked: Boolean(chapter.isPermanentlyLocked),
  };
}

function parseAzoraChaptersFromHtml(html, slug) {
  const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linkPattern = new RegExp(
    `<a[^>]+href=["']/series/${escapedSlug}/([^"']+)["'][^>]*>([\\s\\S]*?)</a>`,
    "gi",
  );
  const chapters = [];
  const seen = new Set();

  for (const match of html.matchAll(linkPattern)) {
    const chapterSlug = match[1];
    if (!chapterSlug.startsWith("chapter-") || seen.has(chapterSlug)) continue;
    seen.add(chapterSlug);
    const block = match[0];
    const label = textOnly(match[2]);
    const number = chapterSlug.replace(/^chapter-/, "");
    chapters.push({
      url: `${AZORA_URL}/series/${slug}/${chapterSlug}`,
      name: label || number,
      number,
      date: "",
      locked: /lucide-lock|مقفل|مدفوع|locked/i.test(block),
    });
  }

  return chapters;
}

function normalizeAzoraImageUrl(raw) {
  const cleaned = raw
    .replace(/\\+/g, "")
    .replace(/&(quot|amp|#39);.*$/i, "")
    .replace(/["'<>].*$/, "")
    .trim();

  try {
    const url = new URL(cleaned);
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    return url.toString();
  } catch {
    return cleaned.replace(/\/public\/\/+upload\//, "/public/upload/");
  }
}

function compareAzoraPages(left, right) {
  const leftPage = Number(left.src.match(/\/(\d{2,3})\.(?:webp|jpe?g|png|avif)$/i)?.[1])
    || Number(left.src.match(/page-(\d+)/i)?.[1])
    || 0;
  const rightPage = Number(right.src.match(/\/(\d{2,3})\.(?:webp|jpe?g|png|avif)$/i)?.[1])
    || Number(right.src.match(/page-(\d+)/i)?.[1])
    || 0;
  return leftPage - rightPage;
}

function extractAzoraChapterPages(html, seriesSlug, title) {
  const escapedSlug = seriesSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const storageBase = "https://storage\\.azorafly\\.com/(?:public/+)?upload/series/";
  const pageFilePattern = "(?:page-[^\"'\\s<>]+|\\d{2,3}\\.(?:webp|jpe?g|png|avif))";
  const patterns = [
    new RegExp(
      `${storageBase}${escapedSlug}/[^"'\\s<>]+/${pageFilePattern}`,
      "gi",
    ),
    new RegExp(
      `<img[^>]+src=["'](${storageBase}${escapedSlug}/[^"']+)["']`,
      "gi",
    ),
    new RegExp(
      `${storageBase}[^"'\\s<>]+/${pageFilePattern}`,
      "gi",
    ),
  ];
  const seen = new Set();
  const pages = [];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const src = normalizeAzoraImageUrl(match[1] || match[0]);
      if (!src || seen.has(src) || !/\/(?:page-|\d{2,3}\.)/i.test(src)) continue;
      seen.add(src);
      pages.push({ src, alt: `${title} · ${pages.length + 1}` });
    }
    if (pages.length) break;
  }

  pages.sort(compareAzoraPages);
  return pages;
}

function isAzoraPaywalledChapter(html, pages) {
  if (pages.length) return false;
  return /مقفل|مدفوع|isPermanentlyLocked|isLocked&quot;:\[0,true\]|يتضمن 0 صفحة كوميك/i.test(html);
}

async function parseAzoraDetails(html, url) {
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop();
  const title = decodeHtml(html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1] ?? slug);
  const cover = html.match(/<img[^>]*alt="Cover of [^"]*"[^>]*src="(https:\/\/storage\.azorafly\.com[^"]+)"/i)?.[1] ?? html.match(/<meta property="og:image" content="(https:\/\/storage\.azorafly\.com[^"]+)"/i)?.[1] ?? "";
  const description = decodeHtml(html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? "");
  const summary = textOnly(description);
  const typeBlock = html.match(/class="lucide lucide-type[\s\S]{0,900}?text-foreground[^>]*>([^<]+)<\/span>/i)?.[1] ?? "مانهوا";
  const mediaType = /رواية/.test(typeBlock) ? "novel" : "manga";
  const postId = extractAzoraPostId(html, slug);
  let chapters = [];

  if (postId) {
    const response = await fetch(`${AZORA_API_URL}/api/chapters?postId=${postId}&skip=0&take=all&order=desc`, { headers: { accept: "application/json", referer: `${AZORA_URL}/` }, signal: AbortSignal.timeout(25_000) });
    if (response.ok) {
      const data = await response.json();
      chapters = (data.post?.chapters || []).map((chapter) => mapAzoraChapter(slug, chapter));
    }
  }

  if (!chapters.length) {
    chapters = parseAzoraChaptersFromHtml(html, slug);
  }

  const taxonomies = parseDetailTaxonomies(html, AZORA_URL);
  return { id: slug, title, altTitle: "", cover, summary, url, source: "AzoraFly", sourceId: "azorafly", mediaType, mediaTypeLabel: mediaType === "novel" ? "رواية" : textOnly(typeBlock), ...taxonomies, chapters };
}

function parseAzoraChapter(html, url) {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const seriesSlug = parts[1];
  const title = decodeHtml(html.match(/<meta name="twitter:title" content="([^"]+)"/i)?.[1] ?? "");
  const novelBlock = html.match(/<div class="novel-reader-content[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  if (novelBlock) {
    const paragraphs = [...novelBlock.matchAll(/<(?:p|h[1-6])[^>]*>([\s\S]*?)<\/(?:p|h[1-6])>/gi)].map((match) => textOnly(match[1])).filter(Boolean);
    return { title, url, kind: "novel", paragraphs, pages: [], locked: false };
  }

  const pages = extractAzoraChapterPages(html, seriesSlug, title);
  const locked = isAzoraPaywalledChapter(html, pages);

  return {
    title,
    url,
    kind: "manga",
    pages,
    paragraphs: [],
    locked,
    paywallMessage: locked ? "هذا الفصل مدفوع على AzoraFly ولا يمكن قراءته هنا." : "",
  };
}

export async function handleAzoraRequest(requestUrl) {
  if (requestUrl.pathname.endsWith("/image")) return await proxyAzoraImage(requestUrl.searchParams.get("url") ?? "");
  if (requestUrl.pathname.endsWith("/filters")) {
    const html = await resolveAzoraHtml(`${AZORA_URL}/series/`);
    return responseJson(200, {
      ...mergeFilterGroups([
        parseAzoraFilters(html),
        parseTaxonomyFilterLinks(html, AZORA_URL, ["azorafly.com"]),
      ]),
      fetchedAt: new Date().toISOString(),
    });
  }
  if (requestUrl.pathname.endsWith("/catalog")) {
    const page = Math.min(Math.max(Number(requestUrl.searchParams.get("page")) || 1, 1), 1000);
    const genre = requestUrl.searchParams.get("genre")?.trim() ?? "";
    if (genre && !/^\d+$/.test(genre)) throw new Error("تصنيف AzoraFly غير صالح");
    const appPageSize = 10;
    const upstreamPageSize = 48;
    const offset = (page - 1) * appPageSize;
    const upstreamPage = Math.floor(offset / upstreamPageSize) + 1;
    const start = offset % upstreamPageSize;
    const genreQuery = genre ? `&genres=${encodeURIComponent(`+${genre}`)}` : "";
    let pool = parseAzoraCatalog(await resolveAzoraHtml(`${AZORA_URL}/series/?page=${upstreamPage}${genreQuery}`));
    if (start + appPageSize > pool.length && pool.length >= upstreamPageSize) pool = pool.concat(parseAzoraCatalog(await resolveAzoraHtml(`${AZORA_URL}/series/?page=${upstreamPage + 1}${genreQuery}`)));
    const items = pool.slice(start, start + appPageSize);
    return responseJson(200, { items, page, genre, hasMore: items.length === appPageSize, fetchedAt: new Date().toISOString() });
  }
  if (requestUrl.pathname.endsWith("/search")) {
    const { query, valid } = normalizeSearchQuery(requestUrl.searchParams.get("q"));
    if (!valid) return responseJson(200, { items: [] });
    const html = await resolveAzoraHtml(`${AZORA_URL}/series/?searchTerm=${encodeURIComponent(query)}`);
    return responseJson(200, { items: parseAzoraCatalog(html).slice(0, 40) });
  }
  if (requestUrl.pathname.endsWith("/manga")) {
    const target = assertAzoraUrl(requestUrl.searchParams.get("url") ?? "");
    return responseJson(200, await parseAzoraDetails(await resolveAzoraHtml(target), target));
  }
  if (requestUrl.pathname.endsWith("/chapter")) {
    const target = assertAzoraUrl(requestUrl.searchParams.get("url") ?? "", true);
    return responseJson(200, parseAzoraChapter(await resolveAzoraHtml(target), target));
  }
  return responseJson(404, { error: "Route AzoraFly inconnue" });
}
