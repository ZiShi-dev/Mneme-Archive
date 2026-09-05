import assert from "node:assert/strict";
import test from "node:test";
import {
  chapterRangeOptionLabel,
  findChapterByNumber,
  sliceChaptersInRange,
  sortChaptersAsc,
} from "../lib/downloads/chapterDownloadRange.js";

const chapters = [
  { url: "/c3", number: "3", name: "Chapter 3" },
  { url: "/c1", number: "1", name: "Chapter 1" },
  { url: "/c2", number: "2", name: "Chapter 2" },
];

test("sortChaptersAsc orders by chapter number", () => {
  const sorted = sortChaptersAsc(chapters);
  assert.deepEqual(sorted.map((chapter) => chapter.number), ["1", "2", "3"]);
});

test("sliceChaptersInRange returns inclusive range regardless of selection order", () => {
  const slice = sliceChaptersInRange(chapters, "/c3", "/c1");
  assert.deepEqual(slice.map((chapter) => chapter.number), ["1", "2", "3"]);
  const middle = sliceChaptersInRange(chapters, "/c2", "/c2");
  assert.deepEqual(middle.map((chapter) => chapter.number), ["2"]);
});

test("chapterRangeOptionLabel prefers number and name", () => {
  assert.equal(chapterRangeOptionLabel({ number: "12", name: "Départ" }), "12 · Départ");
  assert.equal(chapterRangeOptionLabel({ number: "5", name: "5" }), "5");
});

test("findChapterByNumber resolves chapter by number", () => {
  const found = findChapterByNumber(chapters, "2");
  assert.equal(found?.number, "2");
  assert.equal(findChapterByNumber(chapters, "99"), null);
});

test("sliceChaptersInRange by numbers through urls", () => {
  const from = findChapterByNumber(chapters, "3");
  const to = findChapterByNumber(chapters, "1");
  const slice = sliceChaptersInRange(chapters, from.url, to.url);
  assert.deepEqual(slice.map((chapter) => chapter.number), ["1", "2", "3"]);
});
