import test from "node:test";
import assert from "node:assert/strict";
import {
  chapterOrderIndex,
  chapterSortKey,
  dedupeChapters,
  extractChapterNumber,
  extractChapterNumberFromUrl,
  normalizeChapterList,
  sortChaptersDesc,
} from "../lib/chapterOrdering.js";

test("extractChapterNumber reads raw chapter labels and urls", () => {
  assert.equal(extractChapterNumber("Chapter 102 raw", "https://example.com/manga/x/chapter-102-raw/"), "102");
  assert.equal(extractChapterNumber("الفصل 24", "https://example.com/manga/x/chapter-24/"), "24");
  assert.equal(extractChapterNumber("", "https://example.com/manga/x/chapter-6/"), "6");
});

test("extractChapterNumber prefers realmnovel url index over misleading labels", () => {
  assert.equal(
    extractChapterNumber("1", "https://realmnovel.com/novel/abc/chapter/942"),
    "942",
  );
  assert.equal(
    extractChapterNumber("الفصل 1", "https://realmnovel.com/novel/abc/chapter/1"),
    "1",
  );
});

test("extractChapterNumberFromUrl supports common novel source url patterns", () => {
  const cases = [
    ["realmnovel", "https://realmnovel.com/novel/abc/chapter/942", "942"],
    ["wtrlab", "https://wtrlab.com/en/book/slug/chapter/15", "15"],
    ["azorafly", "https://azorafly.com/manga/x/chapter-5/", "5"],
    ["kolnovel", "https://kolnovel.com/novel/slug/chapter-12/", "12"],
    ["kolnovel post id", "https://kolnovel.com/shaag24novel-az435ggye-290554/", ""],
    ["galaxy", "https://galaxynovels.com/novel/slug/chapter-3/", "3"],
    ["cenele", "https://cenele.com/cont/slug/vol/الفصل-7/", "7"],
    ["dilar", "https://dilar.tube/reader/abc/-/12", "12"],
    ["dilar decimal", "https://dilar.tube/reader/abc/-/12.5", "12.5"],
    ["manhwaread", "https://manhwaread.com/manhwa/x/chapter-102/", "102"],
    ["novelsparadise", "https://novelsparadise.site/novel-a-942/", "942"],
    ["novelsparadise alt slug", "https://novelsparadise.site/i-am-the-fated-villain-1-2/", "2"],
    ["animedar", "https://animedar.net/anime-p/demo-anime/?ep=12", "12"],
    ["wiflix", "https://www.wiflix.tv/watch/you-saison-1?language=VF&episode=8", "8"],
  ];
  for (const [, url, expected] of cases) {
    assert.equal(extractChapterNumberFromUrl(url), expected, url);
  }
});

test("chapterSortKey ignores misleading labels when url carries the index", () => {
  assert.equal(chapterSortKey({ name: "1", url: "https://realmnovel.com/novel/x/chapter/942" }), 942);
  assert.equal(chapterSortKey({ name: "1", url: "https://example.com/manga/x/chapter-942/" }), 942);
  assert.equal(chapterSortKey({ name: "999", url: "https://azorafly.com/manga/x/chapter-5/" }), 5);
});

test("chapterOrderIndex falls back to server number only when url has no index", () => {
  assert.equal(chapterOrderIndex({ name: "الفصل 12", number: "12", url: "https://example.com/read/abc" }), 12);
  assert.equal(chapterOrderIndex({ name: "999", number: "12", url: "https://example.com/read/abc" }), 12);
  assert.equal(chapterOrderIndex({ name: "999", number: "12.5", url: "https://example.com/read/abc" }), 12.5);
});

test("normalizeChapterList keeps realmnovel chapter 1 distinct from arc part labels", () => {
  const chapters = normalizeChapterList([
    { number: "1", name: "الفصل 1", url: "https://realmnovel.com/novel/x/chapter/1" },
    { number: "942", name: "1", url: "https://realmnovel.com/novel/x/chapter/942" },
  ]);
  assert.equal(chapters.length, 2);
  assert.equal(chapters.find((chapter) => chapter.url.endsWith("/chapter/1"))?.number, "1");
  assert.equal(chapterSortKey(chapters.find((chapter) => chapter.url.endsWith("/chapter/1"))), 1);
});

test("dedupeChapters ignores misleading labels and keeps url-based chapter numbers", () => {
  const chapters = dedupeChapters([
    { number: "1", name: "1", url: "https://realmnovel.com/novel/x/chapter/942" },
    { number: "1", name: "الفصل 1", url: "https://realmnovel.com/novel/x/chapter/1" },
  ]);
  assert.equal(chapters.length, 2);
  assert.deepEqual(chapters.map((chapter) => chapter.number).sort(), ["1", "942"]);
});

test("sortChaptersDesc orders numeric chapters newest first", () => {
  const sorted = sortChaptersDesc([
    { number: "1", name: "Chapter 1", url: "https://example.com/chapter-1/" },
    { number: "6", name: "Chapter 6", url: "https://example.com/chapter-6/" },
    { number: "5 raw", name: "Chapter 5 raw", url: "https://example.com/chapter-5-raw/" },
  ]);
  assert.deepEqual(sorted.map((chapter) => chapter.number), ["6", "5 raw", "1"]);
});

test("dedupeChapters keeps one entry per chapter number", () => {
  const chapters = dedupeChapters([
    { number: "102 raw", name: "Chapter 102 raw", url: "https://example.com/chapter-102-raw/", publishedAt: "2026-07-15T00:00:00.000Z" },
    { number: "102", name: "Chapter 102", url: "https://example.com/chapter-102/", publishedAt: "2026-07-14T00:00:00.000Z" },
    { number: "101", name: "Chapter 101", url: "https://example.com/chapter-101/" },
  ]);
  assert.equal(chapters.length, 2);
  assert.equal(chapters.find((chapter) => chapter.number === "102")?.url, "https://example.com/chapter-102-raw/");
});

test("normalizeChapterList dedupes and sorts", () => {
  const chapters = normalizeChapterList([
    { number: "1", name: "Chapter 1", url: "https://example.com/chapter-1/" },
    { number: "5 raw", name: "Chapter 5 raw", url: "https://example.com/chapter-5-raw/" },
    { number: "5", name: "Chapter 5", url: "https://example.com/chapter-5/" },
    { number: "6", name: "Chapter 6", url: "https://example.com/chapter-6/" },
  ]);
  assert.deepEqual(chapters.map((chapter) => extractChapterNumber(chapter.name, chapter.url)), ["6", "5", "1"]);
  assert.equal(chapterSortKey(chapters[1]), 5);
});

test("normalizeChapterList keeps distinct Wiflix episode query params", () => {
  const base = "https://www.wiflix.tv/watch/you-saison-1-streaming-complet-vf-vostfr";
  const chapters = normalizeChapterList([
    { number: "1", name: "1", url: `${base}?language=VF&episode=1` },
    { number: "2", name: "2", url: `${base}?language=VF&episode=2` },
    { number: "10", name: "10", url: `${base}?language=VF&episode=10` },
  ]);
  assert.equal(chapters.length, 3);
  assert.deepEqual(chapters.map((chapter) => chapter.number).sort((a, b) => Number(a) - Number(b)), ["1", "2", "10"]);
});
