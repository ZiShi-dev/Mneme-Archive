import test from "node:test";
import assert from "node:assert/strict";
import { mapConnectionType } from "../lib/platform/networkStatus.js";

test("mapConnectionType detects wifi", () => {
  const result = mapConnectionType("wifi", true);
  assert.equal(result.wifiLike, true);
  assert.equal(result.label, "Wi-Fi");
});

test("mapConnectionType detects cellular", () => {
  const result = mapConnectionType("cellular", true);
  assert.equal(result.wifiLike, false);
  assert.equal(result.label, "بيانات الهاتف");
});

test("mapConnectionType handles offline state", () => {
  const result = mapConnectionType("wifi", false);
  assert.equal(result.wifiLike, false);
  assert.equal(result.label, "غير متصل");
});

test("mapConnectionType handles save data mode", () => {
  const result = mapConnectionType("wifi", true, true);
  assert.equal(result.wifiLike, false);
  assert.equal(result.label, "توفير البيانات");
});
