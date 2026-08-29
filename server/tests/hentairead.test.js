import test from "node:test";
import assert from "node:assert/strict";
import {
  assertHentaireadUrl,
  buildHentaireadReaderUrl,
  extractHentaireadChapterImages,
  parseHentaireadCatalog,
  parseHentaireadChapter,
} from "../sources/hentairead.js";

const CATALOG_CARD = `
<article class="manga-item">
  <a class="manga-item__link" href="https://hentairead.com/hentai/sample-doujin/" title="Sample Doujin">
    <img class="manga-item__img-inner" src="https://hencover.xyz/covers/sample.webp" alt="Sample Doujin" />
    <div class="manga-item__detail line-clamp-2">Sample Doujin</div>
  </a>
</article>`;

const CHAPTER_PAGE = `
<h1>Sample Doujin</h1>
<script id="single-chapter-js-extra">
var single_chapter = {"baseUrl":"https://hencover.xyz/data/sample"};
</script>
<script id="single-chapter-js-before">.eyJkYXRhIjp7ImNoYXB0ZXIiOnsiaW1hZ2VzIjpbeyJzcmMiOiIwMDEud2VicCIsImFsdCI6InBhZ2UgMSJ9LHsic3JjIjoiMDAyLndlYnAiLCJhbHQiOiJwYWdlIDIifV19fX0=</script>`;

test("parseHentaireadCatalog reads manga cards", () => {
  const items = parseHentaireadCatalog(CATALOG_CARD);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Sample Doujin");
  assert.equal(items[0].sourceId, "hentairead");
  assert.match(items[0].cover, /hencover\.xyz/);
});

test("assertHentaireadUrl validates manga and chapter links", () => {
  assert.equal(
    assertHentaireadUrl("https://hentairead.com/hentai/sample-doujin/"),
    "https://hentairead.com/hentai/sample-doujin/",
  );
  assert.equal(
    assertHentaireadUrl("https://hentairead.com/hentai/sample-doujin/english/p/3/", true),
    "https://hentairead.com/hentai/sample-doujin/english/p/3/",
  );
});

test("buildHentaireadReaderUrl builds english reader path", () => {
  assert.equal(
    buildHentaireadReaderUrl("https://hentairead.com/hentai/sample-doujin/"),
    "https://hentairead.com/hentai/sample-doujin/english/p/1/",
  );
});

test("extractHentaireadChapterImages decodes base64 payload", () => {
  const images = extractHentaireadChapterImages(CHAPTER_PAGE);
  assert.equal(images.length, 2);
  assert.match(images[0].src, /001\.webp$/);
});

test("parseHentaireadCatalog reads lazy-loaded covers", () => {
  const lazyCard = `
<article class="manga-item">
  <a class="manga-item__link" href="https://hentairead.com/hentai/lazy-cover/" title="Lazy Cover">
    <img class="manga-item__img-inner" data-lazy-src="https://hencover.xyz/covers/lazy.webp" alt="Lazy Cover" />
  </a>
</article>`;
  const items = parseHentaireadCatalog(lazyCard);
  assert.equal(items.length, 1);
  assert.match(items[0].cover, /lazy\.webp$/);
});

test("parseHentaireadChapter returns decoded pages", () => {
  const chapter = parseHentaireadChapter(
    CHAPTER_PAGE,
    "https://hentairead.com/hentai/sample-doujin/english/p/1/",
  );
  assert.equal(chapter.pages.length, 2);
  assert.equal(chapter.title, "Sample Doujin");
});
