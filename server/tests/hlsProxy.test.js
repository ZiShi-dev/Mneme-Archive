import test from "node:test";
import assert from "node:assert/strict";
import {
  filterM3u8Ads,
  isAdSegmentUrl,
  isM3u8Payload,
  readResponseBytesLimited,
  rewriteM3u8Playlist,
} from "../lib/hlsProxy.js";

test("isM3u8Payload detects playlist markers", () => {
  assert.equal(isM3u8Payload("", "#EXTM3U\n#EXT-X-VERSION:3"), true);
  assert.equal(isM3u8Payload("video/mp4", ""), false);
});

test("isAdSegmentUrl detects common ad playlist urls", () => {
  assert.equal(isAdSegmentUrl("https://cdn.example.com/troll/master.m3u8"), true);
  assert.equal(isAdSegmentUrl("https://cdn.example.com/hls2/01/file.urlset/master.m3u8"), false);
});

test("filterM3u8Ads removes ad segments and cue tags", () => {
  const body = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-CUE-OUT:30
#EXTINF:6.0,
https://cdn.example.com/ads/preroll.ts
#EXTINF:6.0,
segment-001.ts`;

  const filtered = filterM3u8Ads(body);
  assert.doesNotMatch(filtered, /preroll|EXT-X-CUE-OUT/i);
  assert.match(filtered, /segment-001\.ts/);
});

test("rewriteM3u8Playlist rewrites absolute and relative urls", () => {
  const body = `#EXTM3U
#EXT-X-VERSION:3
https://cdn1.k1c6x8p.shop/?token=abc
segment.ts`;
  const rewritten = rewriteM3u8Playlist(
    body,
    "https://cdn1.k1c6x8p.shop/?token=master",
    (url) => `/proxy?url=${encodeURIComponent(url)}`,
  );
  assert.match(rewritten, /\/proxy\?url=/);
  assert.match(rewritten, /segment\.ts/);
});

test("readResponseBytesLimited rejects oversized Content-Length", async () => {
  const response = {
    headers: { get: (name) => (name === "content-length" ? "100" : null) },
    body: null,
    arrayBuffer: async () => new ArrayBuffer(8),
  };
  await assert.rejects(
    () => readResponseBytesLimited(response, 50),
    /trop volumineux/i,
  );
});

test("readResponseBytesLimited accepts under-limit body", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const response = {
    headers: { get: () => null },
    body: null,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
  const result = await readResponseBytesLimited(response, 100);
  assert.deepEqual([...result], [1, 2, 3, 4]);
});

test("pickHeader reads case-insensitive plain headers", async () => {
  const { pickHeader } = await import("../lib/hlsProxy.js");
  assert.equal(pickHeader({ Range: "bytes=0-1" }, "range"), "bytes=0-1");
  assert.equal(pickHeader({ range: "bytes=2-3" }, "Range"), "bytes=2-3");
});

test("fetchProxiedMediaBytes returns stream-pipe with range", async () => {
  const { fetchProxiedMediaBytes } = await import("../lib/hlsProxy.js");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.Range, "bytes=0-7");
    return {
      ok: false,
      status: 206,
      headers: {
        get: (name) => ({
          "content-type": "video/mp4",
          "content-length": "8",
          "content-range": "bytes 0-7/100",
          "accept-ranges": "bytes",
        }[name] || null),
      },
      body: {
        getReader: () => ({ read: async () => ({ done: true, value: undefined }) }),
      },
    };
  };
  try {
    const result = await fetchProxiedMediaBytes({
      target: "https://example.com/a.mp4",
      referer: "https://hentaigasm.com/",
      range: "bytes=0-7",
    });
    assert.equal(result.kind, "stream-pipe");
    assert.equal(result.status, 206);
    assert.equal(result.contentType, "video/mp4");
    assert.equal(result.contentRange, "bytes 0-7/100");
    assert.ok(result.body);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
