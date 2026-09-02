import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_APP_SETTINGS } from "../lib/settings/defaults.js";
import { normalizeSettings } from "../lib/settings/normalizeSettings.js";
import {
  getDefaultSourceBaseUrl,
  getEffectiveSourceBaseUrl,
  normalizeSourceBaseUrl,
  normalizeSourceBaseUrlOverrides,
} from "../lib/settings/sourceBaseUrls.js";

test("normalizeSourceBaseUrl keeps https origin", () => {
  assert.equal(
    normalizeSourceBaseUrl("mangalik", "https://mirror.example.com/path"),
    "https://mirror.example.com",
  );
});

test("normalizeSourceBaseUrlOverrides stores only custom domains", () => {
  const overrides = normalizeSourceBaseUrlOverrides({
    mangalik: "https://mirror.example.com",
    wiflix: getDefaultSourceBaseUrl("wiflix"),
  });
  assert.equal(overrides.mangalik, "https://mirror.example.com");
  assert.equal(overrides.wiflix, undefined);
});

test("getEffectiveSourceBaseUrl falls back to profile default", () => {
  assert.equal(
    getEffectiveSourceBaseUrl("mangalik", {}),
    getDefaultSourceBaseUrl("mangalik"),
  );
});
