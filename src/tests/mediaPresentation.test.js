import test from "node:test";
import assert from "node:assert/strict";
import { resolveVideoPlayback } from "../features/sources/mediaPresentation.js";

test("resolveVideoPlayback ignores catalog html pages as direct video urls", () => {
  const playback = resolveVideoPlayback({
    url: "https://www.wiflix.tv/film-en-streaming/244840-demo.html",
    sources: [{ url: "", streamUrl: "" }],
    embedUrl: "",
  });
  assert.equal(playback, null);
});

test("resolveVideoPlayback keeps embed urls", () => {
  const playback = resolveVideoPlayback({
    embedUrl: "https://uqload.net/embed-demo.html",
    url: "https://www.wiflix.tv/film-en-streaming/244840-demo.html",
  });
  assert.deepEqual(playback, {
    mode: "embed",
    url: "https://uqload.net/embed-demo.html",
  });
});

test("resolveVideoPlayback uses video mode for mp4 stream sources", () => {
  const playback = resolveVideoPlayback({
    streamType: "mp4",
    playbackMode: "video",
    sources: [{
      streamUrl: "https://hgasm2.com/sample.mp4",
      streamType: "mp4",
      streamReferer: "https://hentaigasm.com/",
    }],
  });
  assert.equal(playback.mode, "video");
  assert.equal(playback.url, "https://hgasm2.com/sample.mp4");
});

test("resolveVideoPlayback keeps hls mode for m3u8 stream sources", () => {
  const playback = resolveVideoPlayback({
    sources: [{
      streamUrl: "https://cdn.example/master.m3u8",
      streamType: "hls",
    }],
  });
  assert.equal(playback.mode, "hls");
});
