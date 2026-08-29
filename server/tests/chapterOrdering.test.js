import test from "node:test";
import assert from "node:assert/strict";
import {
  chapterSortKey,
  dedupeChapters,
  extractChapterNumber,
  normalizeChapterList,
  sortChaptersDesc,
} from "../lib/chapterOrdering.js";

test("extractChapterNumber reads raw chapter labels and urls", () => {
  assert.equal(extractChapterNumber("Chapter 102 raw", "https://example.com/manga/x/chapter-102-raw/"), "102");
  assert.equal(extractChapterNumber("الفصل 24", "https://example.com/manga/x/chapter-24/"), "24");
  assert.equal(extractChapterNumber("", "https://example.com/manga/x/chapter-6/"), "6");
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
