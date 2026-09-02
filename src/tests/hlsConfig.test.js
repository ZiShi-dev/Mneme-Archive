import test from "node:test";
import assert from "node:assert/strict";
import { createHlsPlayerConfig, getVideoPreloadMode, prefersHighVideoQuality } from "../lib/hls/hlsConfig.js";
import {
  pickBestPlaybackSourceIndex,
  scorePlaybackSource,
  sortPlaybackSources,
} from "../lib/hls/playbackQuality.js";

test("createHlsPlayerConfig uses smaller buffers on metered connections", () => {
  const config = createHlsPlayerConfig({ nativeMobile: false });
  if (prefersHighVideoQuality()) {
    assert.equal(config.maxBufferLength, 45);
    assert.equal(config.maxMaxBufferLength, 90);
    assert.equal(config.startLevel, -1);
    assert.equal(config.capLevelToPlayerSize, false);
  } else {
    assert.equal(config.maxBufferLength, 12);
    assert.equal(config.maxMaxBufferLength, 24);
  }
});

test("createHlsPlayerConfig keeps a compact buffer on Android WebView", () => {
  const config = createHlsPlayerConfig({ nativeMobile: true });
  if (prefersHighVideoQuality()) {
    assert.equal(config.maxBufferLength, 24);
    assert.equal(config.maxMaxBufferLength, 48);
  } else {
    assert.equal(config.maxBufferLength, 12);
    assert.equal(config.maxMaxBufferLength, 24);
  }
});

test("getVideoPreloadMode avoids eager buffering on metered connections", () => {
  const mode = getVideoPreloadMode();
  assert.ok(mode === "metadata" || mode === "auto");
});

test("sortPlaybackSources prefers HLS vidzy streams", () => {
  const ranked = sortPlaybackSources([
    { label: "Uqload", url: "https://uqload.net/embed-a.html", streamUrl: "https://uqload.net/hls.m3u8", streamType: "hls" },
    { label: "Vidzy", url: "https://vidzy.cc/embed-b.html", streamUrl: "https://vidzy.cc/master.m3u8", streamType: "hls" },
    { label: "Embed", url: "https://example.com/embed.html" },
  ]);
  assert.equal(ranked[0].label, "Vidzy");
  assert.ok(scorePlaybackSource(ranked[0]) > scorePlaybackSource(ranked[1]));
  assert.equal(pickBestPlaybackSourceIndex([
    { label: "Uqload", url: "https://uqload.net/embed-a.html" },
    { label: "Vidzy", url: "https://vidzy.cc/embed-b.html", streamUrl: "https://vidzy.cc/master.m3u8", streamType: "hls" },
  ]), 1);
});
