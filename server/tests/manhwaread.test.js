import test from "node:test";
import assert from "node:assert/strict";
import {
  assertManhwareadUrl,
  extractManhwareadChapterImages,
  parseManhwareadCatalog,
  parseManhwareadChapter,
  parseManhwareadChapters,
} from "../sources/manhwaread.js";
import { createHostContext } from "../lib/sourceBaseUrl.js";

const CTX = createHostContext("https://manhwaread.com");

const CATALOG_CARD = `
<div class="manga-item loop-item group/manga-item ">
  <div class="manga-item__img">
    <img class="manga-item__img-inner" alt="Sample Manhwa" src="https://mancover.xyz/cover/2026/02/sample.webp" />
  </div>
  <div class="manga-item__bottom">
    <h3><a href="https://manhwaread.org/manhwa/sample-manhwa/">Sample Manhwa</a></h3>
  </div>
</div>`;

const CHAPTER_LIST = `
<div id="chaptersList" class="chapters-list">
  <a href="https://manhwaread.org/manhwa/sample-manhwa/chapter-01/" class="chapter-item">
    <span class="chapter-item__name">Chapter 01</span>
    <span class="chapter-item__date">22/02/2026</span>
  </a>
  <a href="https://manhwaread.org/manhwa/sample-manhwa/chapter-02/" class="chapter-item">
    <span class="chapter-item__name">Chapter 02</span>
    <span class="chapter-item__date">23/02/2026</span>
  </a>
</div>`;

const CHAPTER_PAGES = [
  { src: "130981/mr_001.jpg", w: 800, h: 1000 },
  { src: "130981/mr_002.jpg", w: 800, h: 1000 },
];
const CHAPTER_DATA = {
  data: Buffer.from(JSON.stringify(CHAPTER_PAGES), "utf8").toString("base64"),
  base: "https://manread.xyz/12474",
};
const CHAPTER_PAGE = `
<h1 id="chapter-heading">Chapter 01</h1>
<script>var chapterData = ${JSON.stringify(CHAPTER_DATA)};</script>
`;

test("parseManhwareadCatalog reads cards and CDN covers", () => {
  const items = parseManhwareadCatalog(CATALOG_CARD, CTX);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Sample Manhwa");
  assert.equal(items[0].sourceId, "manhwaread");
  assert.equal(items[0].url, "https://manhwaread.com/manhwa/sample-manhwa/");
  assert.match(items[0].cover, /mancover\.xyz\/cover\//);
});

test("assertManhwareadUrl accepts mirrors and chapter paths", () => {
  assert.equal(
    assertManhwareadUrl("https://www.manhwaread.org/manhwa/sample-manhwa/", CTX),
    "https://manhwaread.com/manhwa/sample-manhwa/",
  );
  assert.equal(
    assertManhwareadUrl("https://manhwaread.com/manhwa/sample-manhwa/chapter-01/", CTX, true),
    "https://manhwaread.com/manhwa/sample-manhwa/chapter-01/",
  );
  assert.throws(() => assertManhwareadUrl("https://evil.example/manhwa/x/", CTX));
});

test("parseManhwareadChapters reverses oldest-first listing", () => {
  const chapters = parseManhwareadChapters(
    CHAPTER_LIST,
    CTX,
    "https://manhwaread.com/manhwa/sample-manhwa/",
  );
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "02");
  assert.equal(chapters[1].number, "01");
  assert.match(chapters[0].url, /chapter-02/);
});

test("extractManhwareadChapterImages decodes chapterData", () => {
  const pages = extractManhwareadChapterImages(CHAPTER_PAGE, CTX);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].src, "https://manread.xyz/12474/130981/mr_001.jpg");
});

test("parseManhwareadChapter returns decoded pages", () => {
  const chapter = parseManhwareadChapter(
    CHAPTER_PAGE,
    "https://manhwaread.com/manhwa/sample-manhwa/chapter-01/",
    CTX,
  );
  assert.equal(chapter.pages.length, 2);
  assert.match(chapter.pages[1].src, /mr_002\.jpg/);
});
