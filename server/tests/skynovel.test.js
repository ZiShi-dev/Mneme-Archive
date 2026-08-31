import test from "node:test";
import assert from "node:assert/strict";
import { parseSkyChapterPayload, fetchSkyJson } from "../lib/skynovelApi.js";

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

test("parseSkyChapterPayload reads nested chapter content", () => {
  const result = parseSkyChapterPayload({
    success: true,
    data: {
      chapter: {
        title: "الفصل 1",
        content: "فقرة واحدة",
      },
    },
  }, "http://example/chapter/1");
  assert.equal(result.title, "الفصل 1");
  assert.deepEqual(result.paragraphs, ["فقرة واحدة"]);
});

test("fetchSkyJson rejects absolute URLs", async () => {
  await assert.rejects(() => fetchSkyJson("https://evil.example/x"), /غير صالح/);
});
