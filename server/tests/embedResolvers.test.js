import assert from "node:assert/strict";
import { test } from "node:test";
import { decodePackedPlayerSource, extractJsChallengeUrl, extractPackedPlayerStreamUrl, assertProxiedEmbedUrl } from "../lib/embedResolvers.js";

test("decodePackedPlayerSource decodes vidzy packed payloads", () => {
  const packed = "YWJjZA==";
  assert.equal(typeof decodePackedPlayerSource(packed, "vidzy.cc"), "string");
});

test("extractPackedPlayerStreamUrl finds plain m3u8 urls", () => {
  const html = '<script>sources:[{file:"https://strm10.uqload.vc/hls2/demo/master.m3u8?t=abc"}]</script>';
  assert.match(
    extractPackedPlayerStreamUrl(html, "uqload.net"),
    /master\.m3u8/,
  );
});

test("assertProxiedEmbedUrl accepts known Wiflix embed hosts", () => {
  assert.equal(
    assertProxiedEmbedUrl("https://1.multiup.us/e/demo"),
    "https://1.multiup.us/e/demo",
  );
  assert.throws(() => assertProxiedEmbedUrl("https://evil.example/embed"), /غير مسموح/);
});

test("extractJsChallengeUrl reads player redirects", () => {
  const html = "<script>window.location.replace('https://flixeo.xyz/player?id=1&ch=1');</script>";
  assert.equal(
    extractJsChallengeUrl(html, "https://flixeo.xyz/uptogorx/newPlayer.php?id=1"),
    "https://flixeo.xyz/player?id=1&ch=1",
  );
});
