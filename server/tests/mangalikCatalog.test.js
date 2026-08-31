import test from "node:test";
import assert from "node:assert/strict";
import { parseMangalikCatalog } from "../sources/mangalik.js";

const CARD = `
<div class="col-12 col-md-6 badge-pos-1">
  <div class="page-item-detail manga">
    <div id="manga-item-1" class="item-thumb c-image-hover">
      <a href="https://mangalik.net/manga/sample-title/" title="Sample Title">
        <img class="img-responsive" src="https://io.mangalik.net/wp-content/uploads/sample.jpg" alt="Sample Title">
      </a>
    </div>
    <div class="item-summary">
      <div class="post-title font-title">
        <h3 class="h5"><a href="https://mangalik.net/manga/sample-title/">Sample Title</a></h3>
      </div>
    </div>
  </div>
</div>
`;

test("parseMangalikCatalog reads current Madara cards", () => {
  const items = parseMangalikCatalog(CARD);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Sample Title");
  assert.equal(items[0].url, "https://mangalik.net/manga/sample-title/");
  assert.match(items[0].cover, /io\.mangalik\.net/);
});

test("parseMangalikCatalog skips feed links", () => {
  const html = `
    <div class="page-item-detail manga">
      <a href="https://mangalik.net/manga/feed/" title="Feed">Feed</a>
      <div class="post-title"><a href="https://mangalik.net/manga/feed/">Feed</a></div>
    </div>
    <div class="page-item-detail manga">
      <div class="post-title"><a href="https://mangalik.net/manga/real-manga/">Real Manga</a></div>
      <img class="img-responsive" src="https://io.mangalik.net/wp-content/uploads/x.jpg" alt="Real Manga">
    </div>
  `;
  const items = parseMangalikCatalog(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Real Manga");
});
