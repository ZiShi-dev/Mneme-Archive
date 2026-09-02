import test from "node:test";
import assert from "node:assert/strict";
import { pickLatestChapter, slimDetailsForFollow } from "../lib/followLatestChapter.js";

test("pickLatestChapter returns highest chapter number", () => {
  const latest = pickLatestChapter([
    { url: "/c/1", number: "1", name: "1" },
    { url: "/c/12", number: "12", name: "12" },
    { url: "/c/3", number: "3", name: "3" },
  ]);
  assert.equal(latest.number, "12");
});

test("slimDetailsForFollow keeps only the latest chapter", () => {
  const slim = slimDetailsForFollow({
    title: "رواية",
    url: "https://example.com/novel/1",
    sourceId: "realmnovel",
    chapters: [
      { url: "/c/10", number: "10", name: "10" },
      { url: "/c/9", number: "9", name: "9" },
    ],
  });
  assert.equal(slim.title, "رواية");
  assert.equal(slim.chapters.length, 1);
  assert.equal(slim.chapters[0].number, "10");
});
