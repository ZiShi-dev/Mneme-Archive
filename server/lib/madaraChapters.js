import { parseChapterDateString, enrichChapterDates as enrichServerChapterDates } from "./chapterDates.js";
import { extractChapterNumber, normalizeChapterList } from "./chapterOrdering.js";
import { textOnly } from "./htmlUtils.js";

export function extractMadaraMangaId(html = "") {
  const match = html.match(/id=["']manga-chapters-holder["'][^>]*data-id=["'](\d+)["']/i)
    ?? html.match(/data-id=["'](\d+)["'][^>]*id=["']manga-chapters-holder["']/i);
  return match?.[1] ?? "";
}

export function parseMadaraChapters(html = "", { normalizeUrl = (url) => url } = {}) {
  const chapters = [];
  const seen = new Set();
  for (const match of html.matchAll(/<li[^>]*class="[^"]*wp-manga-chapter[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)) {
    const link = match[1].match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const url = normalizeUrl(link[1]);
    if (!url || seen.has(url)) continue;
    const date = textOnly(match[1].match(/<span[^>]*class="[^"]*chapter-release-date[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const name = textOnly(link[2]);
    const number = extractChapterNumber(name, url) || name.replace(/^(?:Chapter|الفصل)\s*/i, "").trim();
    const publishedAt = parseChapterDateString(date);
    seen.add(url);
    chapters.push({
      url,
      number,
      date,
      ...(publishedAt ? { publishedAt } : {}),
    });
  }
  return chapters;
}

export async function fetchMadaraChapterListHtml(baseUrl, mangaId, refererUrl) {
  const response = await fetch(`${baseUrl}/wp-admin/admin-ajax.php`, {
    method: "POST",
    redirect: "follow",
    headers: {
      accept: "*/*",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      referer: refererUrl,
      origin: baseUrl,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "x-requested-with": "XMLHttpRequest",
    },
    body: new URLSearchParams({ action: "manga_get_chapters", manga: mangaId }),
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) throw new Error(`Madara chapters ${response.status}`);
  return await response.text();
}

export async function resolveMadaraChapters(html, { baseUrl, refererUrl, normalizeUrl }) {
  const inlineChapters = parseMadaraChapters(html, { normalizeUrl });
  const mangaId = extractMadaraMangaId(html);
  let chapters = inlineChapters;
  if (mangaId) {
    try {
      const chapterHtml = await fetchMadaraChapterListHtml(baseUrl, mangaId, refererUrl);
      const ajaxChapters = parseMadaraChapters(chapterHtml, { normalizeUrl });
      chapters = ajaxChapters.length >= inlineChapters.length ? ajaxChapters : inlineChapters;
    } catch {
      chapters = inlineChapters;
    }
  }
  return enrichServerChapterDates(normalizeChapterList(chapters));
}
