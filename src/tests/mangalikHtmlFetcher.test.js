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

test("mangalik catalog falls back to FlareSolverr when direct HTTP is blocked", async () => {
  const { configureFlareSolverr } = await import("../../server/lib/flareSolverrConfig.js");
  const { responseCache } = await import("../../server/lib/httpUtils.js");
  const originalFetch = globalThis.fetch;
  responseCache.clear();
  configureFlareSolverr(() => ({ baseUrl: "http://127.0.0.1:8191" }));
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/v1")) {
      return {
        ok: true,
        async json() {
          return {
            status: "ok",
            solution: {
              response: '<html><body><div class="page-item-detail manga"><a href="/manga/sample/" title="Sample"><div class="post-title"><a>Sample</a></div></a></div></body></html>',
            },
          };
        },
      };
    }
    return {
      ok: false,
      status: 403,
      async text() { return "<html>Just a moment...</html>"; },
    };
  };
  try {
    const { handleMangalikRequest } = await import("../../server/sources/mangalik.js");
    const response = await handleMangalikRequest(new URL("http://localhost/api/sources/mangalik/catalog?page=1"));
    assert.equal(response.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    configureFlareSolverr(() => null);
    responseCache.clear();
  }
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
    normalizeNativeHtmlUrl("https://mangalik.net/manga/sample-title/"),
    "https://mangalik.net/manga/sample-title/",
  );
  assert.equal(
    normalizeNativeHtmlUrl("https://mangalik.net/manga/sample-title/12/?style=paged"),
    "https://mangalik.net/manga/sample-title/12/?style=list",
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

test("isMangaLikCdnImage accepts chapter CDN hosts and rejects the apex site", async () => {
  const { isMangaLikCdnImage } = await import("../lib/platform/mangalikNative.js");
  assert.equal(isMangaLikCdnImage("https://tempsolo.mangalik.net/manga/arb5/data/x/image-01.jpg"), true);
  assert.equal(isMangaLikCdnImage("https://io.mangalik.net/wp-content/uploads/cover.jpg"), true);
  assert.equal(isMangaLikCdnImage("https://mangalik.net/manga/sample-title/12/"), false);
  assert.equal(isMangaLikCdnImage("https://evil.example/manga/x.jpg"), false);
});

test("webViewSources marks native catalog sources", async () => {
  const { WEBVIEW_SOURCE_IDS, FLARE_DIRECT_SOURCE_IDS, shouldDeferCatalogFilters } = await import("../lib/platform/webViewSources.js");
  assert.deepEqual(WEBVIEW_SOURCE_IDS, ["azorafly", "galaxynovels", "novelphoenix"]);
  assert.deepEqual(FLARE_DIRECT_SOURCE_IDS, ["mangalik", "novelsparadise"]);
  assert.equal(shouldDeferCatalogFilters("azorafly"), true);
  assert.equal(shouldDeferCatalogFilters("mangalik"), true);
  assert.equal(shouldDeferCatalogFilters("paradise"), false);
});
