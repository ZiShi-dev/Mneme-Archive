import test from "node:test";
import assert from "node:assert/strict";
import {
  assertMangadistrictUrl,
  extractMangadistrictId,
  parseMangadistrictCatalog,
  parseMangadistrictChapter,
  parseMangadistrictChapters,
} from "../sources/mangadistrict.js";

const CATALOG_CARD = `
<div class="page-item-detail manga">
  <div id="manga-item-330169" class="item-thumb" data-post-id="330169">
    <a href="https://mangadistrict.com/series/sample-series/" title="Sample Series">
      <img class="img-responsive" alt="Sample Series"
        src="data:image/svg+xml,%3Csvg/%3E"
        data-default-src="https://cdn.mangadistrict.com/thumbnail/sample-series-official.webp"
        data-mature-static="https://cdn.mangadistrict.com/thumbnail/sample-series-full.webp" />
    </a>
  </div>
  <div class="item-summary">
    <div class="post-title font-title"><h3><a href="https://mangadistrict.com/series/sample-series/">Sample Series</a></h3></div>
    <span class="chapter"><a href="https://mangadistrict.com/series/sample-series/chapter-10/">Chapter 10</a></span>
  </div>
</div>`;

const CHAPTER_LIST = `
<li class="wp-manga-chapter">
  <a href="https://mangadistrict.com/series/sample-series/chapter-10/">Chapter 10</a>
  <span class="chapter-release-date"><i>August 20, 2026</i></span>
</li>`;

const CHAPTER_PAGE = `
<h1 id="chapter-heading">Chapter 10</h1>
<img id="image-99999" src="https://cdn.mangadistrict.com/assets/publication/media/image/000001.jpg" class="wp-manga-chapter-img">
<img id="image-0" src="https://cdn.mangadistrict.com/publication/manga_abc/chapter-10/01.jpg" class="wp-manga-chapter-img">
<img id="image-1" src="https://cdn.mangadistrict.com/publication/manga_abc/chapter-10/02.jpg" class="wp-manga-chapter-img">`;

test("parseMangadistrictCatalog reads series cards and CDN covers", () => {
  const items = parseMangadistrictCatalog(CATALOG_CARD);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Sample Series");
  assert.equal(items[0].sourceId, "mangadistrict");
  assert.equal(items[0].url, "https://mangadistrict.com/series/sample-series/");
  assert.match(items[0].cover, /cdn\.mangadistrict\.com\/thumbnail\//);
  assert.equal(items[0].recentChapters[0].number, "10");
});

test("assertMangadistrictUrl accepts series and chapter paths", () => {
  assert.equal(
    assertMangadistrictUrl("https://www.mangadistrict.com/series/sample-series/"),
    "https://mangadistrict.com/series/sample-series/",
  );
  assert.equal(
    assertMangadistrictUrl("https://mangadistrict.com/series/sample-series/chapter-10/", true),
    "https://mangadistrict.com/series/sample-series/chapter-10/",
  );
  assert.throws(() => assertMangadistrictUrl("https://evil.example/series/x/"));
  assert.throws(() => assertMangadistrictUrl("https://mangadistrict.com/manga/sample/"));
});

test("extractMangadistrictId reads post id fallbacks", () => {
  assert.equal(extractMangadistrictId(`<div id="manga-chapters-holder" data-id="42"></div>`), "42");
  assert.equal(extractMangadistrictId(`<div data-post-id="330169"></div>`), "330169");
});

test("parseMangadistrictChapters reads chapter links", () => {
  const chapters = parseMangadistrictChapters(CHAPTER_LIST);
  assert.equal(chapters.length, 1);
  assert.equal(chapters[0].number, "10");
  assert.match(chapters[0].url, /\/series\/sample-series\/chapter-10\//);
});

test("parseMangadistrictChapter skips decoy and keeps CDN pages", () => {
  const chapter = parseMangadistrictChapter(
    CHAPTER_PAGE,
    "https://mangadistrict.com/series/sample-series/chapter-10/",
  );
  assert.equal(chapter.pages.length, 2);
  assert.match(chapter.pages[0].src, /chapter-10\/01\.jpg/);
  assert.doesNotMatch(chapter.pages.map((page) => page.src).join(" "), /000001\.jpg/);
});
