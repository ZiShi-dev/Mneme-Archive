import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings } from "../lib/settings/normalizeSettings.js";
import { DEFAULT_APP_SETTINGS, PRELOAD_PAGES_MAX, PRELOAD_PAGES_MIN } from "../lib/settings/defaults.js";

test("normalizeSettings returns defaults for invalid input", () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_APP_SETTINGS);
  assert.deepEqual(normalizeSettings([]), DEFAULT_APP_SETTINGS);
});

test("normalizeSettings clamps preload pages", () => {
  assert.equal(normalizeSettings({ preloadPages: 99 }).preloadPages, PRELOAD_PAGES_MAX);
  assert.equal(normalizeSettings({ preloadPages: 0 }).preloadPages, PRELOAD_PAGES_MIN);
});

test("normalizeSettings preserves booleans", () => {
  assert.equal(normalizeSettings({ preload: false }).preload, false);
  assert.equal(normalizeSettings({ wifi: false }).wifi, false);
});

test("normalizeSettings normalizes coflix base url", () => {
  assert.equal(
    normalizeSettings({ coflixBaseUrl: "https://coflix.foo/path" }).coflixBaseUrl,
    "https://coflix.foo",
  );
  assert.equal(
    normalizeSettings({ coflixBaseUrl: "http://insecure.test" }).coflixBaseUrl,
    DEFAULT_APP_SETTINGS.coflixBaseUrl,
  );
});
