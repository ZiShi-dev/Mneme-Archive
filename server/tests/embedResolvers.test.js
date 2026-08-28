import assert from "node:assert/strict";
import { test } from "node:test";
import { decodePackedPlayerSource, extractPackedPlayerStreamUrl } from "../lib/embedResolvers.js";

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
