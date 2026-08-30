import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedEmbedUrl, isBlockedAdUrl, resolveEmbedIframeSandbox, resolveEmbedReferrerPolicy, EMBED_IFRAME_SANDBOX } from "../lib/video/embedHosts.js";

test("isAllowedEmbedUrl accepts known embed hosts", () => {
  assert.equal(isAllowedEmbedUrl("https://voe.sx/e/qonxoejekgfo"), true);
  assert.equal(isAllowedEmbedUrl("https://share4max.org/iframe/test"), true);
  assert.equal(isAllowedEmbedUrl("https://vkvideo.ru/video_ext.php?oid=1"), true);
  assert.equal(isAllowedEmbedUrl("https://uqload.net/embed-inh4wma7x0c6.html"), true);
  assert.equal(isAllowedEmbedUrl("https://96ar.com/e/bzoyawt79xkz"), true);
  assert.equal(isAllowedEmbedUrl("https://sandratableother.com/e/tiqqkzxpghgm"), true);
  assert.equal(isAllowedEmbedUrl("https://vidzy.org/embed-3y1qhyxv6mly.html"), true);
  assert.equal(isAllowedEmbedUrl("https://filemoon.to/e/isugfy4c2zta"), true);
  assert.equal(isAllowedEmbedUrl("https://diananatureforeign.com/e/wbhrkoio8ptz"), true);
  assert.equal(isAllowedEmbedUrl("https://drive.google.com/file/d/abc123/preview"), true);
  assert.equal(isAllowedEmbedUrl("https://www.dailymotion.com/embed/video/x9wub4g"), true);
  assert.equal(isAllowedEmbedUrl("https://www.ok.ru/videoembed/123456"), true);
});

test("isAllowedEmbedUrl rejects unknown and ad hosts", () => {
  assert.equal(isAllowedEmbedUrl("https://evil.example/iframe"), false);
  assert.equal(isAllowedEmbedUrl("https://megamax.me/embed/abc"), false);
  assert.equal(isAllowedEmbedUrl("http://voe.sx/e/test"), false);
  assert.equal(isBlockedAdUrl("https://pagead2.googlesyndication.com/pagead/js"), true);
});

test("resolveEmbedReferrerPolicy allows Google Drive preview", () => {
  assert.equal(
    resolveEmbedReferrerPolicy("https://drive.google.com/file/d/abc/preview"),
    "strict-origin-when-cross-origin",
  );
  assert.equal(
    resolveEmbedReferrerPolicy("https://voe.sx/e/test"),
    "no-referrer",
  );
});

test("resolveEmbedIframeSandbox skips sandbox for hosts that reject it", () => {
  assert.equal(resolveEmbedIframeSandbox("https://voe.sx/e/qonxoejekgfo"), undefined);
  assert.equal(resolveEmbedIframeSandbox("https://drive.google.com/file/d/abc/preview"), undefined);
  assert.equal(resolveEmbedIframeSandbox("https://vkvideo.ru/video_ext.php?oid=1"), EMBED_IFRAME_SANDBOX);
});
