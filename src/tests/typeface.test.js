import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTypeface,
  FONT_CLASSIC,
  FONT_KUFI,
  FONT_NASKH,
  FONT_SANS,
  normalizeTypefaceId,
  resolveTypeface,
  typefaceHintKey,
  typefaceNameKey,
} from "../lib/theme/typeface.js";

test("normalizeTypefaceId keeps known font ids", () => {
  assert.equal(normalizeTypefaceId("sans"), FONT_SANS);
  assert.equal(normalizeTypefaceId("naskh"), FONT_NASKH);
  assert.equal(normalizeTypefaceId("kufi"), FONT_KUFI);
  assert.equal(normalizeTypefaceId("classic"), FONT_CLASSIC);
});

test("normalizeTypefaceId falls back to the readable sans preset", () => {
  assert.equal(normalizeTypefaceId("unknown"), FONT_SANS);
  assert.equal(normalizeTypefaceId(null), FONT_SANS);
  assert.equal(normalizeTypefaceId({ id: "naskh" }), FONT_NASKH);
});

test("resolveTypeface accepts a custom CSS family name", () => {
  const custom = resolveTypeface("IBM Plex Sans Arabic");
  assert.equal(custom.id, "custom");
  assert.match(custom.sans, /IBM Plex Sans Arabic/);
  assert.equal(custom.arabic, custom.sans);
});

test("resolveTypeface accepts a stack object", () => {
  const custom = resolveTypeface({ family: "Cairo", display: "Reem Kufi" });
  assert.equal(custom.id, "custom");
  assert.match(custom.sans, /Cairo/);
  assert.match(custom.display, /Reem Kufi/);
});

test("applyTypeface returns the resolved id without a document", () => {
  assert.equal(applyTypeface("naskh"), FONT_NASKH);
  assert.equal(applyTypeface("My Custom Font"), "custom");
});

test("typeface i18n keys follow the preset id", () => {
  assert.equal(typefaceNameKey("sans"), "settings.fontSans");
  assert.equal(typefaceHintKey("kufi"), "settings.fontKufiHint");
});
