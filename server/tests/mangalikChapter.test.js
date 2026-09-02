import test from "node:test";
import assert from "node:assert/strict";
import { parseChapter, mangalikHtmlLooksValid, assertMangaLikImageUrl } from "../sources/mangalik.js";

const CHAPTER_URL = "https://mangalik.net/manga/little-lady-lilina/36/";

const CHAPTER_HTML = `
<html>
  <h1 id="chapter-heading">Little Lady Lilina - الفصل 36</h1>
  <div class="reading-content">
    <div class="page-break no-gaps">
      <img id="image-0" src="https://tempsolo.mangalik.net/manga/arb5/data/x/image-01.jpg" class="wp-manga-chapter-img" alt="1">
    </div>
    <div class="page-break no-gaps">
      <img id="image-1" class="wp-manga-chapter-img" data-src="https://tempsolo.mangalik.net/manga/arb5/data/x/image-02.jpg" src="data:image/svg+xml;base64,abc" alt="2">
    </div>
  </div>
</html>
`;

test("parseChapter reads MangaLik tempsolo page images", () => {
  const chapter = parseChapter(CHAPTER_HTML, CHAPTER_URL);
  assert.match(chapter.title, /Lilina|الفصل/);
  assert.equal(chapter.pages.length, 2);
  assert.equal(
    chapter.pages[0].src,
    "https://tempsolo.mangalik.net/manga/arb5/data/x/image-01.jpg",
  );
  assert.equal(
    chapter.pages[1].src,
    "https://tempsolo.mangalik.net/manga/arb5/data/x/image-02.jpg",
  );
});

test("parseChapter ignores junk placeholders and keeps CDN hosts", () => {
  const html = `
    <div class="reading-content">
      <img src="https://mangalik.net/wp-content/themes/madara/images/logo.png" class="logo">
      <img class="wp-manga-chapter-img" src="https://tempsolo.mangalik.net/manga/x/01.webp">
    </div>
  `;
  const chapter = parseChapter(html, "https://mangalik.net/manga/x/1/");
  assert.equal(chapter.pages.length, 1);
  assert.match(chapter.pages[0].src, /tempsolo\.mangalik\.net/);
});

test("parseChapter does not treat reading-content-wrap as the reader body", () => {
  const html = `
    <div class="reading-content-wrap">
      <img src="https://mangalik.net/wp-content/themes/madara/images/logo.png">
      <div class="reading-content">
        <img class="wp-manga-chapter-img" src="https://tempsolo.mangalik.net/manga/x/02.webp">
      </div>
    </div>
  `;
  const chapter = parseChapter(html, "https://mangalik.net/manga/x/2/");
  assert.equal(chapter.pages.length, 1);
  assert.match(chapter.pages[0].src, /02\.webp$/);
});

test("mangalikHtmlLooksValid accepts chapter HTML and rejects catalog HTML for chapter URLs", () => {
  const catalogHtml = '<html><body><div class="page-item-detail manga">catalog</div></body></html>'.repeat(20);
  assert.equal(mangalikHtmlLooksValid(CHAPTER_HTML, CHAPTER_URL), true);
  assert.equal(mangalikHtmlLooksValid(catalogHtml, CHAPTER_URL), false);
});

test("mangalikHtmlLooksValid accepts manga detail HTML on detail URLs", () => {
  const detailHtml = '<html><body><div class="post-title"><h1>Title</h1></div><div id="manga-chapters-holder" data-id="1"></div></body></html>'.repeat(10);
  assert.equal(
    mangalikHtmlLooksValid(detailHtml, "https://mangalik.net/manga/sample-title/"),
    true,
  );
});

test("assertMangaLikImageUrl allows tempsolo CDN chapter images", () => {
  const url = assertMangaLikImageUrl("https://tempsolo.mangalik.net/manga/arb5/data/x/image-01.jpg");
  assert.equal(url, "https://tempsolo.mangalik.net/manga/arb5/data/x/image-01.jpg");
});

test("assertMangaLikImageUrl allows io CDN covers", () => {
  const url = assertMangaLikImageUrl("https://io.mangalik.net/wp-content/uploads/2024/01/cover.jpg");
  assert.equal(url, "https://io.mangalik.net/wp-content/uploads/2024/01/cover.jpg");
});

test("assertMangaLikImageUrl rejects external image hosts", () => {
  assert.throws(
    () => assertMangaLikImageUrl("https://evil.example/manga/x.jpg"),
    /رابط الصورة غير مسموح/,
  );
});
