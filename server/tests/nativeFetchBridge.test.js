import test from "node:test";
import assert from "node:assert/strict";
import {
  clearSourceNativeFetch,
  configureSourceNativeFetch,
  fetchNativeHtml,
  hasNativeHtmlFetcher,
} from "../lib/nativeFetchBridge.js";

test("nativeFetchBridge shares fetchers through globalThis", async () => {
  clearSourceNativeFetch();
  assert.equal(hasNativeHtmlFetcher(), false);

  configureSourceNativeFetch({
    fetchHtml: async (url) => `<html data-url="${url}"></html>`,
  });

  const html = await fetchNativeHtml("https://novelsparadise.site/series/", async () => {
    throw new Error("remote_fetch_should_not_run");
  });
  assert.match(html, /novelsparadise\.site/);
  clearSourceNativeFetch();
});
