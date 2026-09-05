import test from "node:test";
import assert from "node:assert/strict";
import { parseSearch, mangalikHtmlLooksValid } from "../sources/mangalik.js";

const TAB_SEARCH_HTML = `
<div class="c-tabs-item__content">
  <div class="tab-thumb"><img data-src="https://io.mangalik.net/wp-content/uploads/solo.jpg" alt="Solo Leveling"></div>
  <div class="post-title"><a href="https://mangalik.net/manga/solo-leveling/">Solo Leveling</a></div>
</div>
`.repeat(3);

const GRID_SEARCH_HTML = `
<div class="page-item-detail manga">
  <div class="item-thumb">
    <a href="https://mangalik.net/manga/naruto/" title="Naruto">
      <img class="img-responsive" src="https://io.mangalik.net/wp-content/uploads/naruto.jpg" alt="Naruto">
    </a>
  </div>
  <div class="post-title"><h3 class="h5"><a href="https://mangalik.net/manga/naruto/">Naruto</a></h3></div>
</div>
`.repeat(3);

test("parseSearch reads Madara tab search results", () => {
  const items = parseSearch(TAB_SEARCH_HTML);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Solo Leveling");
  assert.equal(items[0].url, "https://mangalik.net/manga/solo-leveling/");
});

test("parseSearch falls back to catalog cards when tabs are absent", () => {
  const items = parseSearch(GRID_SEARCH_HTML);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Naruto");
  assert.equal(items[0].url, "https://mangalik.net/manga/naruto/");
});

test("mangalikHtmlLooksValid accepts search URLs with minimal templates", () => {
  const searchUrl = "https://mangalik.net/?s=solo&post_type=wp-manga";
  const html = "<html><body><div class='search-no-results'>لا توجد نتائج</div></body></html>".repeat(8);
  assert.equal(mangalikHtmlLooksValid(html, searchUrl), true);
});

test("handleMangalikRequest search filters genre catalog locally", async () => {
  const { handleMangalikRequest } = await import("../sources/mangalik.js");
  const { configureSourceNativeFetch, clearSourceNativeFetch } = await import("../lib/nativeFetchBridge.js");
  const title = "The Return Of Senior Disciple Lee Hoo";
  configureSourceNativeFetch({
    fetchHtml: async (url) => {
      if (String(url).includes("/manga-genre/action/")) {
        return `
          <div class="page-item-detail manga">
            <div class="item-thumb">
              <a href="https://mangalik.net/manga/the-return-of-senior-disciple-lee-hoo/" title="${title}">
                <img class="img-responsive" src="https://io.mangalik.net/wp-content/uploads/cover.jpg" alt="${title}">
              </a>
            </div>
            <div class="post-title"><h3 class="h5"><a href="https://mangalik.net/manga/the-return-of-senior-disciple-lee-hoo/">${title}</a></h3></div>
          </div>
        `.repeat(2);
      }
      return "";
    },
  });
  try {
    const response = await handleMangalikRequest(
      new URL(`http://localhost/api/sources/mangalik/search?q=${encodeURIComponent(title)}&genre=action`),
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].title, title);
  } finally {
    clearSourceNativeFetch();
  }
});

test("handleMangalikRequest search merges parallel wp-json endpoints", async () => {
  const { handleMangalikRequest } = await import("../sources/mangalik.js");
  const { configureSourceNativeFetch, clearSourceNativeFetch } = await import("../lib/nativeFetchBridge.js");
  configureSourceNativeFetch({
    fetchHtml: async (url) => {
      const target = String(url);
      if (target.includes("/wp/v2/wp-manga")) {
        return JSON.stringify([{
          slug: "solo-leveling",
          title: { rendered: "Solo Leveling" },
          link: "https://mangalik.net/manga/solo-leveling/",
        }]);
      }
      if (target.includes("/wp/v2/manga")) {
        return JSON.stringify([{
          slug: "naruto",
          title: { rendered: "Naruto" },
          link: "https://mangalik.net/manga/naruto/",
        }]);
      }
      return "[]";
    },
  });
  try {
    const response = await handleMangalikRequest(new URL("http://localhost/api/sources/mangalik/search?q=level"));
    assert.equal(response.status, 200);
    assert.equal(response.body.items.length, 2);
    assert.deepEqual(
      response.body.items.map((item) => item.title).sort(),
      ["Naruto", "Solo Leveling"],
    );
  } finally {
    clearSourceNativeFetch();
  }
});

test("handleMangalikRequest search uses catalog fallback HTML", async () => {
  const { handleMangalikRequest } = await import("../sources/mangalik.js");
  const { configureSourceNativeFetch, clearSourceNativeFetch } = await import("../lib/nativeFetchBridge.js");
  configureSourceNativeFetch({
    fetchHtml: async (url) => {
      if (String(url).includes("wp-json")) return "[]";
      if (String(url).includes("s=solo")) return GRID_SEARCH_HTML;
      return "";
    },
  });
  try {
    const response = await handleMangalikRequest(new URL("http://localhost/api/sources/mangalik/search?q=solo"));
    assert.equal(response.status, 200);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].title, "Naruto");
  } finally {
    clearSourceNativeFetch();
  }
});
