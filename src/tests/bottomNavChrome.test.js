import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveBottomNavScrollHidden,
  shouldRevealBottomNavOnTap,
} from "../lib/platform/bottomNavChrome.js";

test("resolveBottomNavScrollHidden keeps nav visible near the top", () => {
  const result = resolveBottomNavScrollHidden({
    scrollTop: 20,
    lastScrollTop: 10,
    currentlyHidden: true,
  });

  assert.deepEqual(result, { hidden: false, lastScrollTop: 20 });
});

test("resolveBottomNavScrollHidden hides nav when scrolling down", () => {
  const result = resolveBottomNavScrollHidden({
    scrollTop: 180,
    lastScrollTop: 150,
    currentlyHidden: false,
  });

  assert.deepEqual(result, { hidden: true, lastScrollTop: 180 });
});

test("resolveBottomNavScrollHidden does not reveal nav when scrolling up", () => {
  const result = resolveBottomNavScrollHidden({
    scrollTop: 140,
    lastScrollTop: 180,
    currentlyHidden: true,
  });

  assert.deepEqual(result, { hidden: true, lastScrollTop: 140 });
});

test("shouldRevealBottomNavOnTap ignores interactive targets", () => {
  const button = { closest: (selector) => (selector.includes("button") ? button : null) };
  assert.equal(shouldRevealBottomNavOnTap(button), false);
  assert.equal(shouldRevealBottomNavOnTap({ closest: () => null }), true);
});
