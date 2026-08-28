import test from "node:test";
import assert from "node:assert/strict";
import { fetchCatalogBatch, resolvePopulatedCatalogPage } from "../features/sources/catalogPaging.js";
import { uiPageToServerStartPage } from "../lib/catalog/catalogLayout.js";

test("uiPageToServerStartPage maps UI pages to server pages", () => {
  assert.equal(uiPageToServerStartPage(1, 1), 1);
  assert.equal(uiPageToServerStartPage(2, 1), 2);
  assert.equal(uiPageToServerStartPage(1, 2), 1);
  assert.equal(uiPageToServerStartPage(2, 2), 3);
  assert.equal(uiPageToServerStartPage(3, 2), 5);
});

test("fetchCatalogBatch merges multiple server pages", async () => {
  const calls = [];
  const result = await fetchCatalogBatch(async (page) => {
    calls.push(page);
    return {
      items: [{ id: String(page) }],
      hasMore: page < 2,
    };
  }, 1, 2);

  assert.deepEqual(calls, [1, 2]);
  assert.equal(result.items.length, 2);
  assert.equal(result.hasMore, false);
});

test("fetchCatalogBatch keeps hasMore from the last page", async () => {
  const result = await fetchCatalogBatch(async (page) => ({
    items: [{ id: `p${page}` }],
    hasMore: page === 2,
  }), 1, 2);

  assert.equal(result.hasMore, true);
});

test("resolvePopulatedCatalogPage falls back to the last populated page", async () => {
  const pages = {
    1: [{ id: "1" }],
    2: [{ id: "2" }],
    3: [{ id: "3" }],
    4: [],
    5: [],
  };

  const resolved = await resolvePopulatedCatalogPage(5, async (page) => ({
    page,
    items: pages[page] || [],
    hasMore: page < 3,
  }));

  assert.equal(resolved.page, 3);
  assert.equal(resolved.clampedFrom, 5);
  assert.deepEqual(resolved.items, [{ id: "3" }]);
});
