import test from "node:test";
import assert from "node:assert/strict";
import { buildSourceEmbedUrl, usesSourceEmbedProxy, wiflixEmbedNeedsProxy } from "../lib/video/sourceEmbedProxy.js";
import {
  findNextPlaybackSourceIndex,
  isEmbedOnlyPlaybackSource,
} from "../features/sources/liveVideo/playbackFallback.js";

test("buildSourceEmbedUrl proxies Wiflix embed urls through the API", () => {
  const url = buildSourceEmbedUrl(
    "wiflix",
    "https://flixeo.xyz/uptogorx/newPlayer.php?id=demo",
    "https://www.wiflix.tv/watch/demo?language=VF&episode=1",
  );

  assert.match(url, /^\/api\/sources\/wiflix\/embed\?/);
  assert.match(url, /referer=/);
  assert.match(url, /url=https%3A%2F%2Fflixeo\.xyz/);
});

test("buildSourceEmbedUrl keeps direct uqload embeds", () => {
  const url = buildSourceEmbedUrl(
    "wiflix",
    "https://uqload.net/embed-demo.html",
    "https://www.wiflix.tv/watch/demo?language=VF&episode=1",
  );
  assert.equal(url, "https://uqload.net/embed-demo.html");
  assert.equal(wiflixEmbedNeedsProxy("https://1.multiup.us/e/demo"), true);
  assert.equal(wiflixEmbedNeedsProxy("https://uqload.net/embed-demo.html"), false);
});

test("findNextPlaybackSourceIndex prefers the next HLS-capable server", () => {
  const sources = [
    { url: "https://vidzy.cc/a", streamUrl: "https://cdn/a.m3u8" },
    { url: "https://uqload.net/b" },
    { url: "https://vidzy.cc/c", streamUrl: "https://cdn/c.m3u8" },
  ];
  assert.equal(findNextPlaybackSourceIndex(sources, 0), 2);
  assert.equal(findNextPlaybackSourceIndex(sources, 2), -1);
});

test("findNextPlaybackSourceIndex falls back to any next server", () => {
  const sources = [
    { url: "https://vidzy.cc/a", streamUrl: "https://cdn/a.m3u8" },
    { url: "https://uqload.net/b" },
  ];
  assert.equal(findNextPlaybackSourceIndex(sources, 0), 1);
});

test("isEmbedOnlyPlaybackSource detects servers without direct stream", () => {
  assert.equal(isEmbedOnlyPlaybackSource({ url: "https://vidzy.cc/embed" }), true);
  assert.equal(isEmbedOnlyPlaybackSource({
    url: "https://vidzy.cc/embed",
    streamUrl: "https://cdn/stream.m3u8",
  }), false);
});
