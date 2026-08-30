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
  const { clearSourceNativeFetch } = await import("../../server/lib/nativeFetchBridge.js");
  configureMangalikNativeFetch({
    fetchHtml: async () => "<html><body><div class='page-item-detail manga'>test</div></body></html>",
    fetchImage: null,
  });
  const { handleMangalikRequest } = await import("../../server/sources/mangalik.js");
  const response = await handleMangalikRequest(new URL("http://localhost/api/sources/mangalik/catalog?page=1"));
  assert.equal(response.status, 200);
  clearSourceNativeFetch();
});

test("configureAzoraflyNativeFetch injects custom html fetcher", async () => {
  const { configureAzoraflyNativeFetch } = await import("../../server/sources/azorafly.js");
  const { clearSourceNativeFetch } = await import("../../server/lib/nativeFetchBridge.js");
  configureAzoraflyNativeFetch({
    fetchHtml: async () => "<html><body><a href=\"/series/demo\" title=\"Demo\">Demo</a></body></html>",
    fetchImage: null,
  });
  const { handleAzoraRequest } = await import("../../server/sources/azorafly.js");
  const response = await handleAzoraRequest(new URL("http://localhost/api/sources/azorafly/filters"));
  assert.equal(response.status, 200);
  clearSourceNativeFetch();
});

test("normalizeNativeHtmlUrl deduplicates catalog page-1 URLs", async () => {
  const { normalizeNativeHtmlUrl } = await import("../lib/platform/nativeHtmlCache.js");
  assert.equal(
    normalizeNativeHtmlUrl("https://azorafly.com/series/"),
    "https://azorafly.com/series/?page=1",
  );
  assert.equal(
    normalizeNativeHtmlUrl("https://azorafly.com/series?page=1"),
    "https://azorafly.com/series/?page=1",
  );
  assert.equal(
    normalizeNativeHtmlUrl("https://mangalik.net/manga"),
    "https://mangalik.net/manga/",
  );
  assert.equal(
    normalizeNativeHtmlUrl("https://galaxynovels.com/library/?library_page=1"),
    "https://galaxynovels.com/library/",
  );
  assert.equal(
    normalizeNativeHtmlUrl("https://kolnovel.com/series/?page=1"),
    "https://kolnovel.com/series/",
  );
  assert.equal(
    normalizeNativeHtmlUrl("https://novelphoenix.com/genre-all/sort-new/status-all/all-novel?page=1"),
    "https://novelphoenix.com/genre-all/sort-new/status-all/all-novel",
  );
});

test("fetchNativeHtmlWithCache reuses in-flight fetch", async () => {
  const { fetchNativeHtmlWithCache, clearNativeHtmlCache } = await import("../lib/platform/nativeHtmlCache.js");
  clearNativeHtmlCache();
  let calls = 0;
  const fetcher = async (url) => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return `<html data-url="${url}"></html>`;
  };
  const [first, second] = await Promise.all([
    fetchNativeHtmlWithCache(fetcher, "https://mangalik.net/manga/"),
    fetchNativeHtmlWithCache(fetcher, "https://mangalik.net/manga"),
  ]);
  assert.equal(calls, 1);
  assert.equal(first, second);
  clearNativeHtmlCache();
});

test("webViewSources marks native catalog sources", async () => {
  const { WEBVIEW_SOURCE_IDS, shouldDeferCatalogFilters } = await import("../lib/platform/webViewSources.js");
  assert.deepEqual(WEBVIEW_SOURCE_IDS, ["mangalik", "azorafly", "galaxynovels", "arabshentai", "hentairead", "mangaforfree", "novelsparadise", "kolnovel", "novelphoenix"]);
  assert.equal(shouldDeferCatalogFilters("azorafly"), true);
  assert.equal(shouldDeferCatalogFilters("paradise"), false);
});
