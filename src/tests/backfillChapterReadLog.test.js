import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChapterLogBackfill,
  groupChapterReadsByDay,
  parseChapterProgressKey,
  resolveTitleKeyForChapter,
} from "../lib/reading/backfillChapterReadLog.js";

test("parseChapterProgressKey extracts source and chapter url", () => {
  const parsed = parseChapterProgressKey("living-archive:chapter-progress:mangalik:https://mangalik.net/manga/x/ch/1");
  assert.equal(parsed.sourceId, "mangalik");
  assert.equal(parsed.chapterUrl, "https://mangalik.net/manga/x/ch/1");
});

test("resolveTitleKeyForChapter matches source prefix", () => {
  const readingHistory = {
    "mangalik:https://mangalik.net/manga/naruto": {
      titleUrl: "https://mangalik.net/manga/naruto",
      chapterUrl: "https://mangalik.net/manga/naruto/ch/10",
      lastReadAt: "2026-08-27T10:00:00.000Z",
      progress: 80,
    },
  };

  const titleKey = resolveTitleKeyForChapter(
    "mangalik",
    "https://mangalik.net/manga/naruto/ch/9",
    readingHistory,
  );
  assert.equal(titleKey, "mangalik:https://mangalik.net/manga/naruto");
});

test("buildChapterLogBackfill merges history and progress keys", () => {
  const readingHistory = {
    "mangalik:https://mangalik.net/manga/naruto": {
      titleUrl: "https://mangalik.net/manga/naruto",
      chapterUrl: "https://mangalik.net/manga/naruto/ch/10",
      chapterNumber: "10",
      chapterName: "10",
      lastReadAt: "2026-08-27T10:00:00.000Z",
      completed: true,
      completedAt: "2026-08-27T10:05:00.000Z",
      progress: 100,
    },
  };

  const progressEntries = [{
    key: "living-archive:chapter-progress:mangalik:https://mangalik.net/manga/naruto/ch/9",
    progress: 95,
  }];

  const log = buildChapterLogBackfill(readingHistory, {}, progressEntries);
  const chapters = log["mangalik:https://mangalik.net/manga/naruto"];
  assert.equal(chapters.length, 2);
});

test("groupChapterReadsByDay groups chapters by calendar day", () => {
  const groups = groupChapterReadsByDay([
    { chapterUrl: "a", readAt: "2026-08-27T10:00:00.000Z", completed: true, progress: 100 },
    { chapterUrl: "b", readAt: "2026-08-26T10:00:00.000Z", completed: false, progress: 50 },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].items.length, 1);
});
