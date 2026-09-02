import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRecentChapterFields,
  enrichCatalogItems,
  normalizeRecentChapters,
  recentChaptersFromCount,
  recentChaptersFromList,
} from "../lib/catalogChapters.js";

test("normalizeRecentChapters strips locks for realmnovel catalog cards", () => {
  const chapters = normalizeRecentChapters([
    { number: "51", name: "51", url: "https://realmnovel.com/novel/x/chapter/51", locked: true, lockReason: "sky-app" },
    { number: "50", name: "50", url: "https://realmnovel.com/novel/x/chapter/50", locked: true },
  ], 2, { sourceId: "realmnovel" });
  assert.equal(chapters.length, 2);
  assert.ok(chapters.every((chapter) => chapter.locked === false));
  assert.equal(chapters[0].lockReason, undefined);
});

test("normalizeRecentChapters keeps two unique chapters with urls", () => {
  const chapters = normalizeRecentChapters([
    { number: "3", name: "3", url: "https://example.com/3" },
    { number: "2", name: "2", url: "https://example.com/2" },
    { number: "1", name: "1", url: "https://example.com/1" },
  ]);
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "3");
  assert.equal(chapters[1].number, "2");
});

test("recentChaptersFromList picks latest chapters from ascending lists", () => {
  const chapters = recentChaptersFromList([
    { number: "1", name: "1", url: "https://example.com/1" },
    { number: "2", name: "2", url: "https://example.com/2" },
    { number: "1318", name: "1318", url: "https://example.com/1318" },
    { number: "1317", name: "1317", url: "https://example.com/1317" },
  ]);
  assert.deepEqual(chapters.map((entry) => entry.number), ["1318", "1317"]);
});

test("recentChaptersFromCount builds descending chapter urls", () => {
  const chapters = recentChaptersFromCount(5, (number) => `https://example.com/${number}`);
  assert.deepEqual(chapters.map((entry) => entry.number), ["5", "4"]);
});

test("applyRecentChapterFields sets latest from first recent chapter", () => {
  const item = applyRecentChapterFields({ title: "Novel" }, [
    { number: "12", name: "12", url: "https://example.com/12" },
    { number: "11", name: "11", url: "https://example.com/11" },
  ]);
  assert.equal(item.latestChapter, "12");
  assert.equal(item.latestChapterUrl, "https://example.com/12");
  assert.equal(item.recentChapters.length, 2);
});

test("enrichCatalogItems writes recent chapters onto catalog items", async () => {
  const items = [
    { title: "A", url: "https://example.com/a", recentChapters: [] },
    { title: "B", url: "https://example.com/b", recentChapters: [] },
  ];
  await enrichCatalogItems(items, {
    enrichItem: async (item) => [
      { number: "8", name: "8", url: `${item.url}/8` },
      { number: "7", name: "7", url: `${item.url}/7` },
    ],
  });
  assert.equal(items[0].recentChapters.length, 2);
  assert.equal(items[0].latestChapter, "8");
  assert.equal(items[0].latestChapterUrl, "https://example.com/a/8");
  assert.equal(items[1].recentChapters[1].url, "https://example.com/b/7");
});
