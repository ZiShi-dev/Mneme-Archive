import test from "node:test";
import assert from "node:assert/strict";
import {
  isPlaceholderCover,
  normalizeRemoteImageUrl,
  pickBestCover,
} from "../features/sources/coverDisplay.js";
import {
  countFavoritesByType,
  favoriteOverviewStats,
  favoriteTypeFilters,
  getBookmarkRowCopy,
  isVisibleFavoriteType,
} from "../features/favorites/favoritesModel.js";

const t = (key, vars = {}) => [key, ...Object.values(vars)].join(":");

test("isPlaceholderCover detects empty and Anime4up logos", () => {
  assert.equal(isPlaceholderCover(""), true);
  assert.equal(isPlaceholderCover("https://4h.shop/wp-content/uploads/images.png"), true);
  assert.equal(isPlaceholderCover("https://cdn.example/Anime4up-Icon-1.png"), true);
  assert.equal(isPlaceholderCover("https://cdn.example/poster.jpg"), false);
});

test("normalizeRemoteImageUrl upgrades http and protocol-relative covers", () => {
  assert.equal(normalizeRemoteImageUrl("//cdn.example/a.jpg"), "https://cdn.example/a.jpg");
  assert.equal(normalizeRemoteImageUrl("http://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
  assert.equal(normalizeRemoteImageUrl("https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
});

test("pickBestCover skips placeholders in favor of a real poster", () => {
  assert.equal(
    pickBestCover("https://site/images.png", "https://cdn.example/novel.jpg"),
    "https://cdn.example/novel.jpg",
  );
  assert.equal(pickBestCover("", "https://cdn.example/manga.jpg"), "https://cdn.example/manga.jpg");
});

test("countFavoritesByType and filters include anime", () => {
  const entries = [
    { type: "manga" },
    { type: "novel" },
    { type: "anime" },
    { type: "anime" },
  ];
  const counts = countFavoritesByType(entries);
  assert.equal(counts.all, 4);
  assert.equal(counts.anime, 2);
  assert.equal(counts.manga, 1);
  const filters = favoriteTypeFilters(counts, ["manga", "novel", "anime", "movie", "series"]);
  assert.deepEqual(filters.map((item) => item.id), ["all", "manga", "novel", "anime"]);
  const stats = favoriteOverviewStats(counts);
  assert.deepEqual(stats.map((item) => item.id), ["manga", "novel", "anime"]);
});

test("favoriteTypeFilters hide chips when a single type is present", () => {
  assert.deepEqual(favoriteTypeFilters({ all: 3, manga: 3, novel: 0, anime: 0, movie: 0, series: 0 }), []);
});

test("isVisibleFavoriteType uses the visible media list", () => {
  assert.equal(isVisibleFavoriteType("anime", ["manga", "novel", "anime"]), true);
  assert.equal(isVisibleFavoriteType("movie", ["series"]), false);
});

test("getBookmarkRowCopy uses episode copy for anime", () => {
  const copy = getBookmarkRowCopy(
    { kind: "live", type: "anime", item: { title: "Naruto" } },
    { number: "12", url: "https://example/ep" },
    t,
  );
  assert.equal(copy.isVideo, true);
  assert.equal(copy.readingLine, "favorites.lastEpisode:12");
  assert.equal(copy.continueLabel, "favorites.continueEpisode:12");
});

test("getBookmarkRowCopy keeps chapter copy for novels", () => {
  const copy = getBookmarkRowCopy(
    { kind: "live", type: "novel", item: { title: "كتاب" } },
    { name: "3", url: "https://example/ch" },
    t,
  );
  assert.equal(copy.isNovel, true);
  assert.equal(copy.isVideo, false);
  assert.equal(copy.readingLine, "favorites.lastChapter:3");
});
