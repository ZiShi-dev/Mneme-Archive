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
