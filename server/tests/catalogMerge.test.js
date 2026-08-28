import test from "node:test";
import assert from "node:assert/strict";
import { extractNumericCatalogId, mergeCatalogByRecency } from "../lib/catalogMerge.js";

test("extractNumericCatalogId reads DLE ids from item id or url", () => {
  assert.equal(extractNumericCatalogId({ id: "244840" }), 244840);
  assert.equal(
    extractNumericCatalogId({ url: "https://www.wiflix.tv/242506-demo.html" }),
    242506,
  );
  assert.equal(extractNumericCatalogId({ id: "speed-demon" }), 0);
});

test("mergeCatalogByRecency sorts numeric ids newest first across movies and series", () => {
  const movies = [
    { id: "244839", title: "Quarter Life Chaos", mediaType: "movie" },
    { id: "151269", title: "The Game", mediaType: "movie" },
  ];
  const series = [
    { id: "242506", title: "Ewusu", mediaType: "series" },
    { id: "244840", title: "Son of the Soil", mediaType: "series" },
  ];
  const merged = mergeCatalogByRecency(movies, series);
  assert.deepEqual(merged.map((item) => item.id), ["244840", "244839", "242506", "151269"]);
});

test("mergeCatalogByRecency preserves single-side lists", () => {
  const movies = [{ id: "10", title: "A" }];
  assert.deepEqual(mergeCatalogByRecency(movies, []), movies);
  assert.deepEqual(mergeCatalogByRecency([], movies), movies);
});
