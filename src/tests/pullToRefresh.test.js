import test from "node:test";
import assert from "node:assert/strict";
import {
  computePullDistance,
  shouldTriggerRefresh,
} from "../hooks/usePullToRefresh.js";

test("computePullDistance returns 0 for non-positive delta", () => {
  assert.equal(computePullDistance(0), 0);
  assert.equal(computePullDistance(-12), 0);
});

test("computePullDistance applies resistance and caps at max pull", () => {
  assert.equal(computePullDistance(100), 42);
  assert.equal(computePullDistance(300), 108);
});

test("shouldTriggerRefresh respects threshold", () => {
  assert.equal(shouldTriggerRefresh(67), false);
  assert.equal(shouldTriggerRefresh(68), true);
  assert.equal(shouldTriggerRefresh(120), true);
});
