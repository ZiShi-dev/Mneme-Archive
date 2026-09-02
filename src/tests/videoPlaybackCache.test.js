import test from "node:test";
import assert from "node:assert/strict";
import {
  chapterDataMatchesUrl,
  playbackSourcesFromChapterData,
  resolveActiveSourceIndex,
  resolveCachedPlaybackData,
} from "../features/sources/liveVideo/videoPlaybackCache.js";

test("chapterDataMatchesUrl accepts prefetch url aliases", () => {
  assert.equal(chapterDataMatchesUrl({ url: "https://a/ep-1" }, "https://a/ep-1"), true);
  assert.equal(chapterDataMatchesUrl({ playerUrl: "https://a/ep-1" }, "https://a/ep-1"), true);
  assert.equal(chapterDataMatchesUrl({ url: "https://a/ep-2" }, "https://a/ep-1"), false);
  assert.equal(chapterDataMatchesUrl(null, "https://a/ep-1"), false);
});

test("resolveCachedPlaybackData prefers prefetch over a generic cache hit", () => {
  const prefetchData = { url: "https://a/ep-1", sources: [{ url: "https://prefetch" }] };
  const cached = { url: "https://a/ep-1", sources: [{ url: "https://cached" }] };
  assert.equal(
    resolveCachedPlaybackData({ prefetchData, cached, chapterUrl: "https://a/ep-1" }),
    prefetchData,
  );
  assert.equal(
    resolveCachedPlaybackData({ prefetchData: null, cached, chapterUrl: "https://a/ep-1" }),
    cached,
  );
  assert.equal(
    resolveCachedPlaybackData({ prefetchData: { url: "https://a/ep-9" }, cached: null, chapterUrl: "https://a/ep-1" }),
    null,
  );
});

test("playbackSourcesFromChapterData ranks HLS sources", () => {
  const ranked = playbackSourcesFromChapterData({
    sources: [
      { label: "Uqload", url: "https://uqload.net/embed-a.html" },
      { label: "Vidzy", url: "https://vidzy.cc/embed-b.html", streamUrl: "https://vidzy.cc/master.m3u8", streamType: "hls" },
    ],
  });
  assert.equal(ranked[0].label, "Vidzy");
  assert.deepEqual(playbackSourcesFromChapterData(null), []);
});

test("resolveActiveSourceIndex honors the server chosen on the details sheet", () => {
  const data = {
    sources: [
      { label: "A", url: "https://a.example/1" },
      { label: "B", url: "https://b.example/2", streamUrl: "https://b.example/2.m3u8", streamType: "hls" },
    ],
  };
  assert.equal(resolveActiveSourceIndex({ data, preferredSourceIndex: 0, applyPreferred: true }), 0);
  assert.equal(resolveActiveSourceIndex({ data, preferredSourceIndex: 99, applyPreferred: true }), 1);
  assert.ok(resolveActiveSourceIndex({ data, applyPreferred: false }) >= 0);
});
