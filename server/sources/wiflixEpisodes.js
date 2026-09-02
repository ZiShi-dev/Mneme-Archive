import { textOnly } from "../lib/htmlUtils.js";
import {
  absoluteMediaUrl,
  assertWatchUrl,
  DEFAULT_CTX,
  episodeUrl,
  normalizeWiflixAudioLabel,
  SOURCE_ID,
  SOURCE_NAME,
  watchEntry,
  watchSlugFromUrl,
} from "./wiflixCore.js";

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

export function parseWiflixEpisodes(html = "", seasonUrl = "", ctx = DEFAULT_CTX) {
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
    if (vf.has(number)) audioLanguages.VF = episodeUrl(seasonUrl, number, "VF", ctx);
    if (vost.has(number)) audioLanguages.VOSTFR = episodeUrl(seasonUrl, number, "VOSTFR", ctx);
    const defaultAudioLanguage = audioLanguages.VF ? "VF" : "VOSTFR";
    const url = audioLanguages[defaultAudioLanguage];
    return {
      ...watchEntry(url, String(number)),
      audioLanguages,
      defaultAudioLanguage,
    };
  });
}

export function parseWiflixDetails(html, url, ctx = DEFAULT_CTX) {
  const canonical = assertWatchUrl(url, ctx);
  const slug = watchSlugFromUrl(canonical, ctx);
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
    ctx,
  );
  const year = parseDetailsYear(html);
  const series = isSeriesHtml(html, title);
  const chapters = series ? parseWiflixEpisodes(html, canonical, ctx) : [watchEntry(canonical, "1")];
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
