import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHomeLatestPayload,
  isLatestChapterUnread,
  pickLatestChapter,
  resolveHomeContinueAction,
} from "../lib/updates/homeLatestModel.js";

test("pickLatestChapter prefers the newest unlocked chapter", () => {
  const latest = pickLatestChapter([
    { url: "https://a/1", number: "1", locked: false },
    { url: "https://a/3", number: "3", locked: true },
    { url: "https://a/2", number: "2", locked: false },
  ]);
  assert.equal(latest.url, "https://a/2");
});

test("isLatestChapterUnread compares the last read chapter", () => {
  const item = { sourceId: "anime4up", url: "https://a/anime" };
  const latest = { url: "https://a/ep-8", number: "8" };
  assert.equal(isLatestChapterUnread(item, latest, {}), true);
  assert.equal(
    isLatestChapterUnread(item, latest, {
      "anime4up:https://a/anime": { chapterUrl: "https://a/ep-8", chapterNumber: "8" },
    }),
    false,
  );
  assert.equal(
    isLatestChapterUnread(item, latest, {
      "anime4up:https://a/anime": { chapterUrl: "https://a/ep-7", chapterNumber: "7" },
    }),
    true,
  );
});

test("buildHomeLatestPayload keeps follow cover when details omit it", () => {
  const payload = buildHomeLatestPayload(
    { title: "Old", cover: "https://cdn/old.jpg", sourceId: "anime4up", url: "https://a/anime" },
    { title: "New", chapters: [{ url: "https://a/ep-1", number: "1" }] },
  );
  assert.equal(payload.item.title, "New");
  assert.equal(payload.item.cover, "https://cdn/old.jpg");
  assert.equal(payload.latestChapter.url, "https://a/ep-1");
});

test("resolveHomeContinueAction opens a live chapter when one is stored", () => {
  assert.deepEqual(
    resolveHomeContinueAction({
      target: {
        kind: "live",
        item: { sourceId: "anime4up", url: "https://a/anime" },
        chapter: { url: "https://a/ep-2", number: "2" },
      },
    }),
    {
      type: "live-reader",
      item: { sourceId: "anime4up", url: "https://a/anime" },
      chapter: { url: "https://a/ep-2", number: "2" },
    },
  );
});

test("resolveHomeContinueAction resolves chapter metadata when url is missing", () => {
  const record = { chapterNumber: "8", chapterName: "Episode 8", chapterUrl: "" };
  assert.deepEqual(
    resolveHomeContinueAction({
      record,
      target: {
        kind: "live",
        item: { sourceId: "anime4up", url: "https://a/series" },
        chapter: { url: "", number: "8", name: "Episode 8" },
      },
    }),
    {
      type: "live-reader-resolve",
      item: { sourceId: "anime4up", url: "https://a/series" },
      chapter: { url: "", number: "8", name: "Episode 8" },
      record,
    },
  );
});

test("resolveHomeContinueAction falls back to the catalog when history is empty", () => {
  assert.deepEqual(resolveHomeContinueAction(null), { type: "navigate", screen: "sources" });
});
