import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeNightNovelContent,
  splitNightNovelParagraphs,
} from "../lib/nightNovelText.js";
import {
  parseChapterTarget,
  parseNightNovelChapter,
  slugFromNovelUrl,
} from "../sources/nightnovel.js";

test("slugFromNovelUrl reads novel slug", () => {
  assert.equal(
    slugFromNovelUrl("https://nightnovelapp.tech/novel/rhlh-alambratwr-mdmr-altryq?lang=ar"),
    "rhlh-alambratwr-mdmr-altryq",
  );
});

test("parseChapterTarget reads read route", () => {
  const target = parseChapterTarget("https://nightnovelapp.tech/read/16/chapter/3?lang=ar");
  assert.equal(target.novelId, 16);
  assert.equal(target.chapterNumber, 3);
});

test("parseNightNovelChapter extracts paragraphs from html", () => {
  const chapter = parseNightNovelChapter({
    title: "الفصل الأول",
    contentHtml: "<p>أول فقرة.</p><p>ثاني فقرة.</p>",
  }, "https://nightnovelapp.tech/read/16/chapter/1?lang=ar");
  assert.equal(chapter.title, "الفصل الأول");
  assert.deepEqual(chapter.paragraphs, ["أول فقرة.", "ثاني فقرة."]);
  assert.equal(chapter.kind, "novel");
});

test("decodeNightNovelContent removes watermark blocks", () => {
  const raw = "مرحبا\uE000noise\uE001 بالعالم";
  assert.equal(decodeNightNovelContent(raw), "مرحبا بالعالم");
});

test("splitNightNovelParagraphs splits cleaned text", () => {
  const paragraphs = splitNightNovelParagraphs("فقرة أولى.\n\nفقرة ثانية.");
  assert.deepEqual(paragraphs, ["فقرة أولى.", "فقرة ثانية."]);
});
