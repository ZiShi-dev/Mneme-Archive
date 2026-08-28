import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChapterUrl,
  buildCoverUrl,
  buildReaderUrl,
  buildReleasePageUrl,
  buildSeriesUrl,
  mapCatalogItem,
  mapDilarPages,
  parseChapterTarget,
  releaseIdFromUrl,
  seriesIdFromUrl,
} from "../sources/dilar.js";

test("seriesIdFromUrl reads mangas path", () => {
  assert.equal(seriesIdFromUrl("https://dilar.tube/mangas/2847/title"), "2847");
});

test("releaseIdFromUrl reads chapter release path", () => {
  assert.equal(releaseIdFromUrl("https://dilar.tube/chapter/155459"), "155459");
});

test("parseChapterTarget reads reader path", () => {
  assert.deepEqual(parseChapterTarget("https://dilar.tube/reader/2847/-/178"), {
    seriesId: "2847",
    chapterNumber: "178",
  });
});

test("buildCoverUrl uses CDN cover path", () => {
  assert.equal(
    buildCoverUrl("2847", "cover.webp"),
    "https://dilar.tube/uploads/manga/cover/2847/cover.webp",
  );
});

test("mapCatalogItem maps latest chapter reader url", () => {
  const item = mapCatalogItem({
    id: "2847",
    title: "Series A",
    cover: "cover.webp",
    seriesType: { name: "مانهوا" },
    latestChapter: { id: "161089", chapter: "12.00", title: "الفصل" },
  });
  assert.equal(item.id, "2847");
  assert.equal(item.url, buildSeriesUrl("2847"));
  assert.equal(item.latestChapter, "12");
  assert.equal(item.latestChapterUrl, buildReaderUrl("2847", "12"));
  assert.equal(item.recentChapters.length, 2);
  assert.equal(item.recentChapters[1].url, buildReaderUrl("2847", "11"));
  assert.equal(item.mediaTypeLabel, "مانهوا");
});

test("buildReleasePageUrl appends media token", () => {
  const url = buildReleasePageUrl({
    teamId: "42",
    storageKey: "abc/page.jpg",
    pageName: "001.jpg",
    mediaToken: "token123",
  });
  assert.equal(
    url,
    "https://dilar.tube/uploads/releases/42/abc/page.jpg/hq/001.jpg?t=token123",
  );
});

test("mapDilarPages builds release urls from storage key", () => {
  const pages = mapDilarPages({
    storage_key: "42/abc",
    init_team_id: "42",
    media_token: "token123",
    pages: [{ url: "001.jpg", dir: "hq" }, { url: "002.jpg" }],
  });
  assert.equal(pages.length, 2);
  assert.match(pages[0].src, /releases\/42\/abc\/hq\/001\.jpg\?t=token123$/);
  assert.match(pages[1].src, /releases\/42\/abc\/hq\/002\.jpg\?t=token123$/);
});
