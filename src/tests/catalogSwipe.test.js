import test from "node:test";
import assert from "node:assert/strict";
import { resolveCatalogSwipeAction } from "../lib/catalog/catalogSwipe.js";

test("resolveCatalogSwipeAction maps LTR swipes to next and previous pages", () => {
  assert.deepEqual(resolveCatalogSwipeAction(-120, 2, "ltr"), { page: 3, direction: "next" });
  assert.deepEqual(resolveCatalogSwipeAction(120, 2, "ltr"), { page: 1, direction: "prev" });
  assert.equal(resolveCatalogSwipeAction(-60, 2, "ltr"), null);
  assert.equal(resolveCatalogSwipeAction(-120, 2, "ltr", 90), null);
});

test("resolveCatalogSwipeAction inverts horizontal direction for RTL", () => {
  assert.deepEqual(resolveCatalogSwipeAction(120, 2, "rtl"), { page: 3, direction: "next" });
  assert.deepEqual(resolveCatalogSwipeAction(-120, 2, "rtl"), { page: 1, direction: "prev" });
});

test("resolveCatalogSwipeAction accepts clearly horizontal gestures", () => {
  assert.deepEqual(resolveCatalogSwipeAction(-130, 1, "ltr", 40), { page: 2, direction: "next" });
});
