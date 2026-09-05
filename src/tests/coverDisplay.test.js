import test from "node:test";
import assert from "node:assert/strict";
import {
  canShowCatalogWatchAction,
  openCatalogWatch,
} from "../features/sources/coverDisplay.js";

const movieItem = {
  url: "https://example.com/anime/mugen-train/",
  mediaType: "movie",
  title: "Mugen Train",
};

test("canShowCatalogWatchAction shows watch CTA for movies without catalog episodes", () => {
  assert.equal(canShowCatalogWatchAction(movieItem, "movie", []), true);
  assert.equal(canShowCatalogWatchAction(movieItem, "movie", [{ url: "https://example.com/ep/1", number: "1" }]), false);
});

test("canShowCatalogWatchAction keeps standalone video behavior", () => {
  const standalone = { url: "https://example.com/v/1", catalogStyle: "standalone" };
  assert.equal(canShowCatalogWatchAction(standalone, "anime", []), true);
});

test("openCatalogWatch opens movie details instead of reader", () => {
  const calls = { details: 0, chapter: 0 };
  openCatalogWatch({
    item: movieItem,
    mediaType: "movie",
    onOpenDetails: () => { calls.details += 1; },
    onOpenChapter: () => { calls.chapter += 1; },
  });
  assert.equal(calls.details, 1);
  assert.equal(calls.chapter, 0);
});

test("openCatalogWatch opens standalone video in reader", () => {
  const calls = { details: 0, chapter: 0 };
  const standalone = { url: "https://example.com/v/1", catalogStyle: "standalone", title: "Clip" };
  openCatalogWatch({
    item: standalone,
    mediaType: "anime",
    onOpenDetails: () => { calls.details += 1; },
    onOpenChapter: () => { calls.chapter += 1; },
  });
  assert.equal(calls.details, 0);
  assert.equal(calls.chapter, 1);
});
