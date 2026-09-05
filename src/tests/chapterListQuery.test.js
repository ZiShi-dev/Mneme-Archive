import assert from "node:assert/strict";
import test from "node:test";
import { chapterMatchesQuery, normalizeChapterSearchText } from "../lib/reading/chapterListQuery.js";

test("normalizeChapterSearchText converts arabic-indic digits", () => {
  assert.equal(normalizeChapterSearchText("الحلقة ١٠"), "الحلقة 10");
});

test("chapterMatchesQuery matches episode number in arabic label", () => {
  const chapter = { number: "10", name: "الحلقة 10", url: "/ep/10" };
  assert.equal(chapterMatchesQuery(chapter, "10"), true);
  assert.equal(chapterMatchesQuery(chapter, "١٠"), true);
  assert.equal(chapterMatchesQuery(chapter, "حلقة"), true);
  assert.equal(chapterMatchesQuery(chapter, "99"), false);
});
