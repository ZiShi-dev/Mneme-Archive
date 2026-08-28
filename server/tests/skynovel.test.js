import test from "node:test";
import assert from "node:assert/strict";
import { parseSkyChapterPayload } from "../lib/skynovelApi.js";

test("parseSkyChapterPayload extracts paragraphs from API data", () => {
  const result = parseSkyChapterPayload({
    success: true,
    data: {
      title: "الفصل 51",
      content: "سطر أول.\n\nسطر ثاني.",
    },
  }, "http://example/chapter/51");
  assert.equal(result.title, "الفصل 51");
  assert.equal(result.paragraphs.length, 2);
  assert.equal(result.kind, "novel");
});
