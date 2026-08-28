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
});

test("parseArabshentaiChapters reads dooplay chapter list", () => {
  const chapters = parseArabshentaiChapters(CHAPTER_LIST);
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "60");
  assert.equal(chapters[0].date, "2024-04-04");
  assert.match(chapters[0].url, /60_035404$/);
});

test("parseArabshentaiChapter reads manga pages", () => {
  const chapter = parseArabshentaiChapter(
    CHAPTER_PAGE,
    "https://arabshentai.com/manga/sample-series/60_035404/",
  );
  assert.equal(chapter.pages.length, 2);
  assert.match(chapter.pages[0].src, /001\.webp$/);
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
