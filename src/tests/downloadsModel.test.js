import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDownloadId,
  filterDownloads,
  getDownloadStats,
  isChapterDownloaded,
  normalizeDownloadItem,
  removeDownloadItem,
  upsertDownloadChapter,
} from "../lib/downloads/downloadsModel.js";

test("normalizeDownloadItem infers complete status", () => {
  const item = normalizeDownloadItem({
    id: "a",
    title: "Test",
    sourceId: "anime4up",
    chapters: [
      { url: "/1", number: "1", status: "complete", progress: 100, sizeBytes: 1024 },
    ],
  });
  assert.equal(item.status, "complete");
  assert.equal(item.downloadedBytes, 1024);
});

test("filterDownloads matches title query", () => {
  const items = [
    normalizeDownloadItem({ id: "1", title: "Black Torch", sourceId: "animedar", chapters: [] }),
    normalizeDownloadItem({ id: "2", title: "Naruto", sourceId: "anime4up", chapters: [] }),
  ].filter(Boolean);
  const filtered = filterDownloads(items, { query: "black" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, "Black Torch");
});

test("removeDownloadItem drops matching id", () => {
  const store = {
    version: 1,
    items: [
      normalizeDownloadItem({ id: "1", title: "A", chapters: [] }),
      normalizeDownloadItem({ id: "2", title: "B", chapters: [] }),
    ].filter(Boolean),
  };
  const next = removeDownloadItem(store, "1");
  assert.equal(next.items.length, 1);
  assert.equal(next.items[0].id, "2");
});

test("getDownloadStats aggregates storage", () => {
  const items = [
    normalizeDownloadItem({
      id: "1",
      title: "A",
      chapters: [{ url: "/1", status: "complete", progress: 100, sizeBytes: 500 }],
    }),
  ].filter(Boolean);
  const stats = getDownloadStats(items);
  assert.equal(stats.total, 1);
  assert.equal(stats.complete, 1);
  assert.equal(stats.storageBytes, 500);
});

test("upsertDownloadChapter creates and updates novel entries", () => {
  const meta = {
    sourceId: "realmnovel",
    title: "Test Novel",
    cover: "/cover.jpg",
    seriesUrl: "https://example.com/novel",
    mediaType: "novel",
  };
  const chapter = { url: "/c1", number: "1", name: "Chapter 1" };
  const downloadId = buildDownloadId(meta.sourceId, meta.seriesUrl);

  let store = upsertDownloadChapter({ version: 1, items: [] }, meta, chapter, {
    status: "downloading",
    progress: 10,
    sizeBytes: 0,
  });
  assert.equal(store.items.length, 1);
  assert.equal(store.items[0].id, downloadId);
  assert.equal(store.items[0].chapters[0].status, "downloading");

  store = upsertDownloadChapter(store, meta, chapter, {
    status: "complete",
    progress: 100,
    sizeBytes: 2048,
    downloadedAt: Date.now(),
  });
  assert.equal(store.items.length, 1);
  assert.equal(store.items[0].status, "complete");
  assert.equal(store.items[0].chapters[0].sizeBytes, 2048);
  assert.equal(isChapterDownloaded(store, meta.sourceId, meta.seriesUrl, chapter.url), true);
});
