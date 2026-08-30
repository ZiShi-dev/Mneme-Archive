import test from "node:test";
import assert from "node:assert/strict";
import { findParadiseChapterIssues, isParadiseChapterHealthy } from "../lib/paradiseChapterQuality.js";
import { parseKolnovelChapters } from "../sources/kolnovel.js";
import { parseParadiseChapter, extractParadiseParagraphs } from "../sources/novelsparadise.js";

const LORD_SERIES_URL = "https://kolnovel.com/series/%d9%84%d9%88%d8%b1%d8%af-%d8%a7%d9%84%d8%ba%d9%88%d8%a7%d9%85%d8%b6/";
const KOL_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  referer: "https://kolnovel.com/series/",
  accept: "text/html,application/xhtml+xml",
};

const FIXED_HASH_HTML = `
  <blockquote><p>قرمزي.</p></blockquote>
  <p class='acecda57cac394bff8926d30f8c172e65' dir="rtl">&#8216;مؤلم!&#8217;<p class="a429fc78ecb608cea800af42fc5c2f384">نص خاطئ</p></p>
  <p class='a3c88ef0bff9e27146cb326431c2be33d' dir="rtl">عالم الأحلام المذهل و المبهرج المملوء بالتمتمات تحطم في لحظة.<p class="a5cb8ed37aabae20e0928acbc51e00dd7">فقرة خاطئة</p></p>
  <div class="shola-widget">.shola-widget { color: red } function sholaTab(){}</div>
`;

test("findParadiseChapterIssues flags merged decoy paragraphs", () => {
  const issues = findParadiseChapterIssues(["‘مؤلم!’ 01: قرمزي.", "فقرة سليمة طويلة بما يكفي لاجتياز الفحص."]);
  assert.ok(issues.some((issue) => issue.startsWith("merged-decoy")));
});

test("extractParadiseParagraphs produces healthy kolnovel hash chapters", () => {
  const paragraphs = extractParadiseParagraphs(FIXED_HASH_HTML);
  assert.equal(isParadiseChapterHealthy(paragraphs), true);
  assert.match(paragraphs.join("\n"), /عالم الأحلام المذهل/);
  assert.ok(!paragraphs.some((paragraph) => /shola|نص خاطئ|فقرة خاطئة/.test(paragraph)));
});

test("other novel parsers do not use paradise hash extraction", async () => {
  const sources = [
    "../sources/animedar.js",
    "../sources/dilar.js",
    "../sources/galaxynovels.js",
    "../sources/cenele.js",
    "../sources/azorafly.js",
    "../sources/mangalik.js",
  ];
  for (const sourcePath of sources) {
    const source = await import(sourcePath);
    const exports = Object.keys(source);
    assert.ok(!exports.includes("extractParadiseParagraphs"), `${sourcePath} should not use paradise hash parser`);
    assert.ok(!exports.includes("parseParadiseChapter"), `${sourcePath} should not use parseParadiseChapter`);
  }
});

async function fetchKolnovelHtml(url) {
  const response = await fetch(url, { headers: KOL_HEADERS, redirect: "follow" });
  const html = await response.text();
  if (!response.ok || /Just a moment/i.test(html)) {
    throw new Error(`Kol Novel indisponible (${response.status})`);
  }
  return html;
}

function pickSampleChapters(chapters, count = 8) {
  if (!chapters.length) return [];
  if (chapters.length <= count) return chapters;
  const picks = new Set([0, chapters.length - 1]);
  const step = Math.max(1, Math.floor((chapters.length - 1) / (count - 2)));
  for (let index = 0; index < chapters.length; index += step) picks.add(index);
  return [...picks].sort((a, b) => a - b).map((index) => chapters[index]);
}

test("kolnovel sampled chapters parse without junk or decoy merges", { timeout: 120_000, skip: !process.env.RUN_LIVE_SOURCE_TESTS }, async () => {
  const seriesHtml = await fetchKolnovelHtml(LORD_SERIES_URL);
  const chapters = parseKolnovelChapters(seriesHtml, LORD_SERIES_URL);
  assert.ok(chapters.length >= 100, `expected full chapter list, got ${chapters.length}`);

  const samples = pickSampleChapters(chapters, 10);
  const failures = [];

  for (const chapter of samples) {
    const html = await fetchKolnovelHtml(chapter.url);
    const parsed = parseParadiseChapter(html, chapter.url);
    const issues = findParadiseChapterIssues(parsed.paragraphs);
    if (issues.length) {
      failures.push({ number: chapter.number, url: chapter.url, issues, preview: parsed.paragraphs[0]?.slice(0, 80) });
    }
    const textLength = parsed.paragraphs.join("").trim().length;
    assert.ok(textLength >= 120, `chapter ${chapter.number} too short (${textLength} chars)`);
    assert.ok(isParadiseChapterHealthy(parsed.paragraphs), `chapter ${chapter.number}: ${issues.join(", ")}`);
  }

  assert.equal(failures.length, 0, JSON.stringify(failures, null, 2));
});
