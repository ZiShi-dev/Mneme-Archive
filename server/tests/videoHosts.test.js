import test from "node:test";
import assert from "node:assert/strict";
import { compareVideoHostRank, sortSourcesByVideoHost, videoHostRank } from "../lib/videoHosts.js";

test("videoHostRank priorise Vidzy avant Dood", () => {
  assert.ok(videoHostRank("https://vidzy.live/foo") < videoHostRank("https://dood.la/bar"));
});

test("sortSourcesByVideoHost trie les sources par hôte", () => {
  const sources = [
    { url: "https://dood.la/a" },
    { url: "https://vidzy.live/b" },
    { url: "https://unknown.host/c" },
  ];
  const sorted = sortSourcesByVideoHost(sources, (entry) => entry.url);
  assert.equal(sorted[0].url, "https://vidzy.live/b");
  assert.equal(sorted[1].url, "https://dood.la/a");
});

test("compareVideoHostRank accepte un ordre personnalisé", () => {
  const customOrder = [/dood/i, /vidzy/i];
  assert.ok(compareVideoHostRank("https://dood.la/a", "https://vidzy.live/b", customOrder) < 0);
});
