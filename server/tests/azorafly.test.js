import test from "node:test";
import assert from "node:assert/strict";
import {
  azoraPageHtmlLooksValid,
  extractAzoraChapterId,
  extractAzoraChapterPages,
  extractAzoraPostId,
  extractAzoraUnlockAt,
  parseAzoraCatalog,
  parseAzoraChapter,
} from "../sources/azorafly.js";

const CATALOG_HTML = `
<div><div class="relative h-full p-1 sm:p-2 flex gap-2 sm:gap-4 rounded-xl border bg-card">
  <a href="/series/sample-manga/" title="Sample Manga">
    <img alt="Sample Manga" src="https://storage.azorafly.com/public/upload/cover.webp" />
    <span class="text-white">مانهوا</span>
    <a href="/series/sample-manga/chapter-10/"><span>الفصل 10</span></a>
  </a>
</div></div>`;

const SERIES_HTML = `
<meta property="og:title" content="Sample Manga" />
<meta name="description" content="Summary text" />
&quot;post&quot;:[0,{&quot;id&quot;:[0,42],&quot;slug&quot;:[0,&quot;sample-manga&quot;]}
<a href="/series/sample-manga/chapter-1/">الفصل 1</a>
<a href="/series/sample-manga/chapter-2/">الفصل 2</a>`;

const CHAPTER_HTML = `
<meta name="twitter:title" content="Chapter 1" />
&quot;id&quot;:[0,9001],&quot;slug&quot;:[0,&quot;chapter-1&quot;]
<img src="https://storage.azorafly.com/public/upload/series/sample-manga/chapter-1/page-1.webp" />
<img src="https://storage.azorafly.com/public/upload/series/sample-manga/chapter-1/page-2.webp" />`;

test("azoraPageHtmlLooksValid accepts catalog and chapter pages", () => {
  assert.equal(azoraPageHtmlLooksValid(CATALOG_HTML, "https://azorafly.com/series/?page=1"), true);
  assert.equal(azoraPageHtmlLooksValid(CHAPTER_HTML, "https://azorafly.com/series/sample-manga/chapter-1/"), true);
  assert.equal(azoraPageHtmlLooksValid("", "https://azorafly.com/series/"), false);
});

test("parseAzoraCatalog extracts series cards", () => {
  const items = parseAzoraCatalog(CATALOG_HTML);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Sample Manga");
  assert.equal(items[0].sourceId, "azorafly");
  assert.ok(items[0].recentChapters?.length || items[0].latestChapter);
});

test("extractAzoraPostId and extractAzoraChapterId read embedded ids", () => {
  assert.equal(extractAzoraPostId(SERIES_HTML, "sample-manga"), 42);
  assert.equal(extractAzoraChapterId(CHAPTER_HTML, "chapter-1"), 9001);
});

test("extractAzoraChapterPages sorts manga pages", () => {
  const pages = extractAzoraChapterPages(
    CHAPTER_HTML,
    "sample-manga",
    "Chapter 1",
  );
  assert.equal(pages.length, 2);
  assert.match(pages[0].src, /page-1\.webp$/);
  assert.match(pages[1].src, /page-2\.webp$/);
});

test("parseAzoraChapter prefers API pages when available", () => {
  const chapter = parseAzoraChapter(CHAPTER_HTML, "https://azorafly.com/series/sample-manga/chapter-1/", {
    chapter: { id: 9001, isAccessible: true },
    pages: [
      { url: "https://storage.azorafly.com/public/upload/series/sample-manga/chapter-1/2.webp", order: 2 },
      { url: "https://storage.azorafly.com/public/upload/series/sample-manga/chapter-1/1.webp", order: 1 },
    ],
  });
  assert.equal(chapter.kind, "manga");
  assert.equal(chapter.pages.length, 2);
  assert.match(chapter.pages[0].src, /\/1\.webp$/);
});

test("extractAzoraUnlockAt reads encoded and plain timestamps", () => {
  assert.equal(
    extractAzoraUnlockAt('&quot;unlockAt&quot;:[0,&quot;2026-09-02T12:00:00.000Z&quot;]'),
    "2026-09-02T12:00:00.000Z",
  );
  assert.equal(extractAzoraUnlockAt('"unlockAt":[0,"2026-09-02T12:00:00.000Z"]'), "2026-09-02T12:00:00.000Z");
});
