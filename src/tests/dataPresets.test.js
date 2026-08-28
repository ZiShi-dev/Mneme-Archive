import test from "node:test";
import assert from "node:assert/strict";
import { DATA_USAGE_PRESETS, buildDataUsageSummary, detectDataUsagePreset } from "../lib/settings/dataPresets.js";
import { normalizeSettings } from "../lib/settings/normalizeSettings.js";

test("normalizeSettings keeps new data usage flags", () => {
  const settings = normalizeSettings({
    homeAutoUpdates: false,
    videoDataSaver: false,
  });
  assert.equal(settings.homeAutoUpdates, false);
  assert.equal(settings.videoDataSaver, false);
});

test("detectDataUsagePreset recognizes saver profile", () => {
  const settings = normalizeSettings(DATA_USAGE_PRESETS.saver.settings);
  assert.equal(detectDataUsagePreset(settings), "saver");
});

test("buildDataUsageSummary describes custom settings", () => {
  const summary = buildDataUsageSummary(normalizeSettings({
    wifi: false,
    preload: true,
    preloadPages: 2,
    homeAutoUpdates: true,
    videoDataSaver: true,
  }));
  assert.match(summary, /2 صفحة/);
});
