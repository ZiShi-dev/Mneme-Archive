import test from "node:test";
import assert from "node:assert/strict";
import {
  clearSourceNativeFetch,
  configureSourceNativeFetch,
} from "../lib/nativeFetchBridge.js";
import { createWpMangaFetchers } from "../lib/wpMangaHttp.js";
import { configureFlareSolverr } from "../lib/flareSolverrConfig.js";
import { responseCache } from "../lib/httpUtils.js";

const CATALOG_HTML = '<div class="page-item-detail manga"><a href="/manga/sample/">Sample</a></div>';

test("resolveHtml falls back to HTTP when native fetch fails or is empty", async () => {
  clearSourceNativeFetch();
  configureSourceNativeFetch({
    fetchHtml: async () => {
      throw new Error("webview_failed");
    },
  });

  const fetchers = createWpMangaFetchers({
    baseUrl: "https://mangalik.net",
    apexHostname: "mangalik.net",
    sourceName: "MangaLik",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => CATALOG_HTML,
    headers: { get: () => "text/html" },
  });

  try {
    const html = await fetchers.resolveHtml("https://mangalik.net/manga/");
    assert.match(html, /page-item-detail/);
  } finally {
    globalThis.fetch = originalFetch;
    clearSourceNativeFetch();
  }
});

test("preferFlareSolverr skips native WebView and source HTTP", async () => {
  clearSourceNativeFetch();
  configureSourceNativeFetch({
    fetchHtml: async () => {
      throw new Error("should not use webview");
    },
  });
  configureFlareSolverr(() => ({ baseUrl: "http://127.0.0.1:8191" }));
  responseCache.clear();

  const called = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    called.push(String(url));
    return {
      ok: true,
      async json() {
        return {
          status: "ok",
          solution: { response: CATALOG_HTML },
        };
      },
    };
  };

  const fetchers = createWpMangaFetchers({
    baseUrl: "https://mangalik.net",
    apexHostname: "mangalik.net",
    sourceName: "MangaLik",
    preferFlareSolverr: true,
  });

  try {
    const html = await fetchers.resolveHtml("https://mangalik.net/manga/");
    assert.match(html, /page-item-detail/);
    assert.equal(called.length, 1);
    assert.equal(called[0], "http://127.0.0.1:8191/v1");
  } finally {
    globalThis.fetch = originalFetch;
    configureFlareSolverr(() => null);
    clearSourceNativeFetch();
    responseCache.clear();
  }
});
