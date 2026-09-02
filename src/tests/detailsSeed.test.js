import test from "node:test";
import assert from "node:assert/strict";
import { detailsHasImmediateChapters, detailsItemFromSeed } from "../features/sources/details/detailsSeed.js";
import { resolveVideoDetailsChapterPageSize } from "../features/sources/videoCatalog.js";

test("detailsItemFromSeed exposes catalog recent episodes as chapters", () => {
  const recentChapters = [{ url: "https://a/ep-8", number: "8", name: "8" }];
  const seeded = detailsItemFromSeed({ title: "Anime A", recentChapters });
  assert.equal(seeded.chapters, recentChapters);
  assert.equal(detailsItemFromSeed({ chapters: [{ url: "https://a/ep-1" }], recentChapters }).chapters[0].url, "https://a/ep-1");
});

test("detailsHasImmediateChapters waits for full chapter list, not catalog recents", () => {
  assert.equal(detailsHasImmediateChapters({}), false);
  assert.equal(detailsHasImmediateChapters({ recentChapters: [{ url: "https://a/ep-1" }] }), false);
  assert.equal(detailsHasImmediateChapters({ chapters: [{ url: "https://a/ep-1" }] }), true);
  assert.equal(detailsHasImmediateChapters({}, { chapters: [{ url: "https://a/ep-2" }] }), true);
});

test("resolveVideoDetailsChapterPageSize shows the full anime4up episode list", () => {
  assert.equal(resolveVideoDetailsChapterPageSize("anime4up", "anime", 20), Number.MAX_SAFE_INTEGER);
  assert.equal(resolveVideoDetailsChapterPageSize("anime4up", "movie", 20), 20);
  assert.equal(resolveVideoDetailsChapterPageSize("wiflix", "series", 20), Number.MAX_SAFE_INTEGER);
});
