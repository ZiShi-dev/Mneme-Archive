import test from "node:test";
import assert from "node:assert/strict";
import {
  clearSourceNativeFetch,
  configureSourceNativeFetch,
} from "../lib/nativeFetchBridge.js";
import { createWpMangaFetchers } from "../lib/wpMangaHttp.js";

const CATALOG_HTML = '<div class="page-item-detail manga"><a href="/manga/sample/">Sample</a></div>';

test("resolveHtml falls back to HTTP when native fetch fails or is empty", async () => {
  clearSourceNativeFetch();
  configureSourceNativeFetch({
    fetchHtml: async () => {
      throw new Error("webview_failed");
    },
  });

  const fetchers = createWpMangaFetchers({
    baseUrl: "https://mangaforfree.com",
    apexHostname: "mangaforfree.com",
    sourceName: "MangaForFree",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => CATALOG_HTML,
    headers: { get: () => "text/html" },
  });

  try {
    const html = await fetchers.resolveHtml("https://mangaforfree.com/manga/");
    assert.match(html, /page-item-detail/);
  } finally {
    globalThis.fetch = originalFetch;
    clearSourceNativeFetch();
  }
});
