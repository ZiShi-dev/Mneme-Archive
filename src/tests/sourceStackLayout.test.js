import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SOURCE_STACK_METRICS,
  measureSourceStackWidth,
  resolveVisibleSourceStackCount,
} from "../components/sources/sourceStackLayout.js";

test("measureSourceStackWidth matches stacked avatar geometry", () => {
  const metrics = DEFAULT_SOURCE_STACK_METRICS;
  assert.equal(measureSourceStackWidth(1, 0, metrics), 27);
  assert.equal(measureSourceStackWidth(4, 0, metrics), 81);
  assert.equal(measureSourceStackWidth(4, 9, metrics), 99);
});

test("resolveVisibleSourceStackCount shows all sources when width allows", () => {
  const result = resolveVisibleSourceStackCount(13, 260, DEFAULT_SOURCE_STACK_METRICS);
  assert.equal(result.visible, 13);
  assert.equal(result.hidden, 0);
});

test("resolveVisibleSourceStackCount prefers full avatars before overflow badge", () => {
  const result = resolveVisibleSourceStackCount(11, 220, DEFAULT_SOURCE_STACK_METRICS);
  assert.equal(result.visible, 11);
  assert.equal(result.hidden, 0);
});

test("resolveVisibleSourceStackCount falls back to overflow badge", () => {
  const result = resolveVisibleSourceStackCount(13, 99, DEFAULT_SOURCE_STACK_METRICS);
  assert.equal(result.visible, 4);
  assert.equal(result.hidden, 9);
});

test("resolveVisibleSourceStackCount keeps at least one visible source", () => {
  const result = resolveVisibleSourceStackCount(8, 20, DEFAULT_SOURCE_STACK_METRICS);
  assert.equal(result.visible, 1);
  assert.equal(result.hidden, 7);
});
