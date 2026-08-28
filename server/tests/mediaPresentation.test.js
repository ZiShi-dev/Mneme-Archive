import test from "node:test";
import assert from "node:assert/strict";
import { getMediaPresentation, isVideoMediaType, resolveVideoPlayback } from "../../src/features/sources/mediaPresentation.js";

test("isVideoMediaType detects anime and movie", () => {
  assert.equal(isVideoMediaType("anime"), true);
  assert.equal(isVideoMediaType("movie"), true);
  assert.equal(isVideoMediaType("manga"), false);
});

test("getMediaPresentation uses episode labels for anime", () => {
  const presentation = getMediaPresentation("anime");
  assert.equal(presentation.sectionTitle, "الحلقات");
  assert.equal(presentation.continueAction, "متابعة المشاهدة");
});

test("getMediaPresentation uses film labels for movies", () => {
  const presentation = getMediaPresentation("movie");
  assert.equal(presentation.sectionTitle, "الفيلم");
  assert.equal(presentation.rowPrefix, "الفيلم");
  assert.equal(presentation.watchLatest, "مشاهدة الفيلم");
});

test("resolveVideoPlayback reads direct, hls and embed urls", () => {
  assert.deepEqual(resolveVideoPlayback({ videoUrl: "https://cdn.example/v.mp4" }), {
    mode: "video",
    url: "https://cdn.example/v.mp4",
    referer: "",
  });
  assert.deepEqual(resolveVideoPlayback({
    streamUrl: "https://cdn.example/v.m3u8",
    playbackMode: "hls",
    streamReferer: "https://player.example/",
  }), {
    mode: "hls",
    url: "https://cdn.example/v.m3u8",
    referer: "https://player.example/",
  });
  assert.deepEqual(resolveVideoPlayback({ embedUrl: "https://embed.example/" }), {
    mode: "embed",
    url: "https://embed.example/",
  });
});
