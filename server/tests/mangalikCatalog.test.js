import test from "node:test";
import assert from "node:assert/strict";
import {
  MANGALIK_CATALOG_PAGE_SIZE,
  fetchMangalikCatalogPage,
  parseMangalikCatalog,
} from "../sources/mangalik.js";

function catalogCard(index, upstreamPage = 1) {
  return `
    <div class="page-item-detail manga">
      <div class="post-title"><a href="https://mangalik.net/manga/item-${upstreamPage}-${index}/">Item ${upstreamPage}-${index}</a></div>
      <img class="img-responsive" src="https://io.mangalik.net/wp-content/uploads/${upstreamPage}-${index}.jpg" alt="Item ${upstreamPage}-${index}">
    </div>
  `;
}

function upstreamCatalogHtml(count, upstreamPage = 1, { hasNext = true } = {}) {
  const cards = Array.from({ length: count }, (_, index) => catalogCard(index, upstreamPage)).join("");
  const next = hasNext ? `<a href="/manga/page/${upstreamPage + 1}/">next</a>` : "";
  return `<html><body>${cards}${next}</body></html>`;
}

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

test("fetchMangalikCatalogPage returns 24 catalog items like Realm Novel", async () => {
  const requested = [];
  const fetchHtml = async (url) => {
    requested.push(url);
    if (url.includes("/manga/page/1/") || url.endsWith("/manga/?m_orderby=latest")) {
      return upstreamCatalogHtml(20, 1);
    }
    if (url.includes("/manga/page/2/")) {
      return upstreamCatalogHtml(20, 2);
    }
    return upstreamCatalogHtml(0, 3, { hasNext: false });
  };

  const ctx = { baseUrl: "https://mangalik.net" };
  const payload = await fetchMangalikCatalogPage(ctx, fetchHtml, { page: 1 });
  assert.equal(payload.items.length, MANGALIK_CATALOG_PAGE_SIZE);
  assert.equal(payload.hasMore, true);
  assert.ok(requested.some((url) => url.includes("/manga/page/2/")), "should spill onto upstream page 2");
});

test("fetchMangalikCatalogPage slices the second app page across upstream pages", async () => {
  const fetchHtml = async (url) => {
    if (url.includes("/manga/page/2/")) return upstreamCatalogHtml(20, 2);
    if (url.includes("/manga/page/3/")) return upstreamCatalogHtml(20, 3);
    return upstreamCatalogHtml(20, 1);
  };

  const ctx = { baseUrl: "https://mangalik.net" };
  const payload = await fetchMangalikCatalogPage(ctx, fetchHtml, { page: 2 });
  assert.equal(payload.items.length, MANGALIK_CATALOG_PAGE_SIZE);
  assert.equal(payload.items[0]?.title, "Item 2-4");
});
