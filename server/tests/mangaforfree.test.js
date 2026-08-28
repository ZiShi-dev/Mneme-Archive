import test from "node:test";
import assert from "node:assert/strict";
import {
  extractMangaforfreeId,
  parseMangaforfreeCatalog,
  parseMangaforfreeChapters,
  parseMangaforfreeChapter,
} from "../sources/mangaforfree.js";

const CATALOG_CARD = `
<div class="page-item-detail manga">
  <div class="item-thumb">
    <a href="https://mangaforfree.com/manga/sample-manga/">
      <img class="img-responsive" src="https://mangaforfree.com/wp-content/uploads/cover.jpg" />
    </a>
  </div>
  <div class="item-summary">
    <div class="post-title font-title"><h3><a href="https://mangaforfree.com/manga/sample-manga/">Sample Manga</a></h3></div>
    <span class="chapter"><a href="https://mangaforfree.com/manga/sample-manga/chapter-10/">Chapter 10</a></span>
  </div>
</div>`;

const CHAPTER_LIST = `
<li class="wp-manga-chapter">
  <a href="https://mangaforfree.com/manga/sample-manga/chapter-10/">Chapter 10</a>
  <span class="chapter-release-date"><i>August 20, 2026</i></span>
</li>`;

const CHAPTER_PAGE = `
<h1 id="chapter-heading">Chapter 10</h1>
<img id="image-0" src="
  https://mangaforfree.com/wp-content/uploads/WP-manga/data/manga_1/page-1.jpg" class="wp-manga-chapter-img">
<img id="image-1" data-src="https://mangaforfree.com/wp-content/uploads/WP-manga/data/manga_1/page-2.jpg" class="wp-manga-chapter-img">`;

test("parseMangaforfreeCatalog reads series cards", () => {
  const items = parseMangaforfreeCatalog(CATALOG_CARD);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Sample Manga");
  assert.equal(items[0].recentChapters[0].number, "10");
});

test("extractMangaforfreeId reads ajax holder id", () => {
  const html = `<div id="manga-chapters-holder" data-id="361905"></div>`;
  assert.equal(extractMangaforfreeId(html), "361905");
});

test("parseMangaforfreeChapters reads chapter links", () => {
  const chapters = parseMangaforfreeChapters(CHAPTER_LIST);
  assert.equal(chapters.length, 1);
  assert.equal(chapters[0].number, "10");
});

test("parseMangaforfreeChapter extracts page images", () => {
  const chapter = parseMangaforfreeChapter(CHAPTER_PAGE, "https://mangaforfree.com/manga/sample-manga/chapter-10/");
  assert.equal(chapter.pages.length, 2);
  assert.match(chapter.pages[0].src, /page-1\.jpg/);
});
