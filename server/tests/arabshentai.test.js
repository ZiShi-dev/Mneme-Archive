import test from "node:test";
import assert from "node:assert/strict";
import {
  assertArabshentaiUrl,
  mergeArabshentaiCatalogItems,
  parseArabshentaiCatalog,
  parseArabshentaiChapter,
  parseArabshentaiChapters,
} from "../sources/arabshentai.js";

const CATALOG_ARTICLE = `
<article id="post-52041" class="item wp-manga">
  <a href="https://arabshentai.com/manga/sample-series/">
    <div class="poster">
      <img src="https://arabshentai.com/wp-content/uploads/2026/07/cover.webp" alt="Sample Series" />
    </div>
  </a>
  <div class="data"><h3><a href="https://arabshentai.com/manga/sample-series/">Sample Series</a></h3></div>
  <div class="latest_ch">
    <div class="chapter-item">
      <span class="chapter font-meta"><a href="https://arabshentai.com/manga/sample-series/41_284408">41</a></span>
    </div>
  </div>
</article>`;

const CHAPTER_LIST = `
<div id="chapter-list">
  <ul>
    <li>
      <a href='https://arabshentai.com/manga/sample-series/60_035404'>
        <div class="chpbox">
          <span class="chapternum">60 - النهاية</span>
          <span class="chapterdate">2024-04-04</span>
        </div>
      </a>
    </li>
    <li>
      <a href="https://arabshentai.com/manga/sample-series/59_291603">
        <div class="chpbox">
          <span class="chapternum">59</span>
          <span class="chapterdate">2024-03-29</span>
        </div>
      </a>
    </li>
  </ul>
</div>`;

const CHAPTER_PAGE = `
<h1>الفصل 60</h1>
<img class="wp-manga-chapter-img img-responsive" src="https://arabshentai.com/wp-content/uploads/WP-manga/data/manga_1/001.webp" alt="page 1" />
<img class="wp-manga-chapter-img img-responsive" data-src="https://arabshentai.com/wp-content/uploads/WP-manga/data/manga_1/002.webp" alt="page 2" />`;

test("parseArabshentaiCatalog reads dooplay cards", () => {
  const items = parseArabshentaiCatalog(CATALOG_ARTICLE);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Sample Series");
  assert.equal(items[0].id, "sample-series");
  assert.equal(items[0].recentChapters[0].number, "41");
  assert.equal(items[0].mediaType, "manga");
});

test("parseArabshentaiCatalog tags anime items from catalog type", () => {
  const items = parseArabshentaiCatalog(CATALOG_ARTICLE, { catalogType: "anime" });
  assert.equal(items[0].catalogKind, "anime");
  assert.equal(items[0].mediaType, "anime");
});

test("parseArabshentaiCatalog accepts reversed dooplay class order", () => {
  const html = CATALOG_ARTICLE.replace('class="item wp-manga"', 'class="wp-manga item"');
  const items = parseArabshentaiCatalog(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Sample Series");
});

test("parseArabshentaiCatalog accepts relative manga links from WebView", () => {
  const html = CATALOG_ARTICLE.replace(/https:\/\/arabshentai\.com/g, "");
  const items = parseArabshentaiCatalog(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://arabshentai.com/manga/sample-series/");
});

test("parseArabshentaiChapters reads dooplay chapter list", () => {
  const chapters = parseArabshentaiChapters(CHAPTER_LIST);
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "60");
  assert.equal(chapters[0].date, "2024-04-04");
  assert.match(chapters[0].url, /60_035404$/);
});

test("parseArabshentaiChapters ignores nav links outside chapter-list", () => {
  const html = `
    <ul class="nav"><li><a href="https://arabshentai.com/">الرئيسية</a></li></ul>
    <div id="chapter-list"><div>
      <ul>
        <li><a href="https://arabshentai.com/manga/sample-series/3_100"><span class="chapternum">3</span></a></li>
      </ul>
    </div></div>
  `;
  const chapters = parseArabshentaiChapters(html);
  assert.equal(chapters.length, 1);
  assert.equal(chapters[0].number, "3");
});

test("parseArabshentaiChapters reads reader chapter select fallback", () => {
  const html = `
    <select class="selectpicker single-chapter-select">
      <option data-redirect="https://arabshentai.com/manga/sample-series/36_300008" selected>36</option>
      <option data-redirect="https://arabshentai.com/manga/sample-series/35_303208">35</option>
    </select>
  `;
  const chapters = parseArabshentaiChapters(html);
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "36");
  assert.match(chapters[1].url, /35_303208$/);
});

test("parseArabshentaiChapter reads manga pages", () => {
  const chapter = parseArabshentaiChapter(
    CHAPTER_PAGE,
    "https://arabshentai.com/manga/sample-series/60_035404/",
  );
  assert.equal(chapter.pages.length, 2);
  assert.match(chapter.pages[0].src, /001\.webp$/);
});

test("parseArabshentaiChapter reads readerarea images without madara class", () => {
  const html = `
    <h1>فصل</h1>
    <div id="readerarea">
      <img data-src="/wp-content/uploads/WP-manga/data/x/01.jpg" alt="1" />
      <img src="/wp-content/uploads/WP-manga/data/x/02.jpg" alt="2" />
    </div>
  `;
  const chapter = parseArabshentaiChapter(html, "https://arabshentai.com/manga/sample/1_1/");
  assert.equal(chapter.pages.length, 2);
  assert.equal(chapter.pages[0].src, "https://arabshentai.com/wp-content/uploads/WP-manga/data/x/01.jpg");
});

test("assertArabshentaiUrl accepts series and chapter urls", () => {
  assert.equal(
    assertArabshentaiUrl("https://arabshentai.com/manga/sample-series/"),
    "https://arabshentai.com/manga/sample-series/",
  );
  assert.equal(
    assertArabshentaiUrl("https://arabshentai.com/manga/sample-series/60_035404/"),
    "https://arabshentai.com/manga/sample-series/60_035404/",
  );
});

test("mergeArabshentaiCatalogItems dedupes urls across type feeds", () => {
  const items = mergeArabshentaiCatalogItems([
    [{ id: "a", title: "A", url: "https://arabshentai.com/manga/a/" }],
    [
      { id: "a", title: "A duplicate", url: "https://arabshentai.com/manga/a/" },
      { id: "b", title: "B", url: "https://arabshentai.com/manga/b/" },
    ],
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "A");
  assert.equal(items[1].id, "b");
});
