import test from "node:test";
import assert from "node:assert/strict";
import { listTitleChapterReads, upsertChapterReadLog } from "../lib/reading/chapterReadLog.js";

const sampleRecord = {
  chapterUrl: "https://example.com/ch/1",
  chapterNumber: "1",
  chapterName: "1",
  lastReadAt: "2026-08-27T10:00:00.000Z",
  completed: true,
  completedAt: "2026-08-27T10:05:00.000Z",
  progress: 100,
};

test("upsertChapterReadLog stores and updates chapters", () => {
  const first = upsertChapterReadLog({}, "title:1", sampleRecord);
  assert.equal(first["title:1"].length, 1);

  const updated = upsertChapterReadLog(first, "title:1", {
    ...sampleRecord,
    lastReadAt: "2026-08-27T11:00:00.000Z",
    progress: 100,
  });
  assert.equal(updated["title:1"].length, 1);
  assert.equal(updated["title:1"][0].readAt, "2026-08-27T11:00:00.000Z");
});

test("listTitleChapterReads falls back to current record", () => {
  const chapters = listTitleChapterReads({}, "title:1", sampleRecord);
  assert.equal(chapters.length, 1);
  assert.equal(chapters[0].chapterName, "1");
});
