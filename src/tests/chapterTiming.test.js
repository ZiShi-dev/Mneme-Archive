import test from "node:test";
import assert from "node:assert/strict";
import { isChapterWithinNewWindow } from "../lib/media/chapterTiming.js";

test("isChapterWithinNewWindow accepts chapters younger than 24h", () => {
  const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const old = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
  assert.equal(isChapterWithinNewWindow(recent), true);
  assert.equal(isChapterWithinNewWindow(old), false);
});
