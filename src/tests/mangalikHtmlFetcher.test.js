import test from "node:test";
import assert from "node:assert/strict";

test("MangalikHtmlFetcher web stub rejects native-only call", async () => {
  const { MangalikHtmlFetcherWeb } = await import("../plugins/mangalikHtmlFetcher.web.js");
  const plugin = new MangalikHtmlFetcherWeb();
  await assert.rejects(
    () => plugin.fetchHtml({ url: "https://mangalik.net/manga/" }),
    /only available on Android/i,
  );
});

test("configureMangalikNativeFetch injects custom html fetcher", async () => {
  const { configureMangalikNativeFetch } = await import("../../server/sources/mangalik.js");
  configureMangalikNativeFetch({
    fetchHtml: async () => "<html><body><div class='page-item-detail manga'>test</div></body></html>",
    fetchImage: null,
  });
  const { handleMangalikRequest } = await import("../../server/sources/mangalik.js");
  const response = await handleMangalikRequest(new URL("http://localhost/api/sources/mangalik/catalog?page=1"));
  assert.equal(response.status, 200);
  configureMangalikNativeFetch({ fetchHtml: null, fetchImage: null });
});

test("configureAzoraflyNativeFetch injects custom html fetcher", async () => {
  const { configureAzoraflyNativeFetch } = await import("../../server/sources/azorafly.js");
  configureAzoraflyNativeFetch({
    fetchHtml: async () => "<html><body><a href=\"/series/demo\" title=\"Demo\">Demo</a></body></html>",
    fetchImage: null,
  });
  const { handleAzoraRequest } = await import("../../server/sources/azorafly.js");
  const response = await handleAzoraRequest(new URL("http://localhost/api/sources/azorafly/filters"));
  assert.equal(response.status, 200);
  configureAzoraflyNativeFetch({ fetchHtml: null, fetchImage: null });
});
