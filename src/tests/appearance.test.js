import test from "node:test";
import assert from "node:assert/strict";
import {
  isDarkTheme,
  isSakuraTheme,
  isSnowTheme,
  isGalaxyTheme,
  normalizeThemeId,
  THEME_INK,
  THEME_NUIT,
  THEME_LUNE_NEIGE,
  THEME_PAPER,
  THEME_SAKURA,
  THEME_YOZAKURA,
  THEME_GALAXIE,
  themeDefaultTypeface,
} from "../lib/theme/appearance.js";

test("normalizeThemeId keeps known appearance ids", () => {
  assert.equal(normalizeThemeId("ink"), THEME_INK);
  assert.equal(normalizeThemeId("nuit"), THEME_NUIT);
  assert.equal(normalizeThemeId("paper"), THEME_PAPER);
  assert.equal(normalizeThemeId("sakura"), THEME_SAKURA);
  assert.equal(normalizeThemeId("yozakura"), THEME_YOZAKURA);
  assert.equal(normalizeThemeId("lune-neige"), THEME_LUNE_NEIGE);
  assert.equal(normalizeThemeId("galaxie"), THEME_GALAXIE);
});

test("normalizeThemeId migrates the previous ink-mode boolean", () => {
  assert.equal(normalizeThemeId(true), THEME_INK);
  assert.equal(normalizeThemeId(false), THEME_PAPER);
  assert.equal(normalizeThemeId("false"), THEME_PAPER);
});

test("normalizeThemeId maps retired sakura aliases", () => {
  assert.equal(normalizeThemeId("usuzakura"), THEME_SAKURA);
  assert.equal(normalizeThemeId("kurozakura"), THEME_INK);
});

test("normalizeThemeId maps galaxy aliases", () => {
  assert.equal(normalizeThemeId("galaxy"), THEME_GALAXIE);
  assert.equal(normalizeThemeId("cosmos"), THEME_GALAXIE);
});

test("isDarkTheme treats ink, nuit, yozakura, lune-neige and galaxie as dark", () => {
  assert.equal(isDarkTheme(THEME_INK), true);
  assert.equal(isDarkTheme(THEME_NUIT), true);
  assert.equal(isDarkTheme(THEME_YOZAKURA), true);
  assert.equal(isDarkTheme(THEME_LUNE_NEIGE), true);
  assert.equal(isDarkTheme(THEME_GALAXIE), true);
  assert.equal(isDarkTheme(THEME_PAPER), false);
  assert.equal(isDarkTheme(THEME_SAKURA), false);
});

test("isSakuraTheme only matches sakura palettes", () => {
  assert.equal(isSakuraTheme(THEME_SAKURA), true);
  assert.equal(isSakuraTheme(THEME_YOZAKURA), true);
  assert.equal(isSakuraTheme(THEME_INK), false);
  assert.equal(isSakuraTheme(THEME_PAPER), false);
  assert.equal(isSakuraTheme(THEME_LUNE_NEIGE), false);
});

test("isSnowTheme only matches lune-neige", () => {
  assert.equal(isSnowTheme(THEME_LUNE_NEIGE), true);
  assert.equal(isSnowTheme(THEME_SAKURA), false);
});

test("isGalaxyTheme only matches galaxie", () => {
  assert.equal(isGalaxyTheme(THEME_GALAXIE), true);
  assert.equal(isGalaxyTheme(THEME_INK), false);
});

test("hasAtmosphereEffect covers animated themes only", async () => {
  const { hasAtmosphereEffect, THEME_NUIT } = await import("../lib/theme/appearance.js");
  assert.equal(hasAtmosphereEffect(THEME_INK), true);
  assert.equal(hasAtmosphereEffect(THEME_NUIT), false);
  assert.equal(hasAtmosphereEffect(THEME_PAPER), true);
  assert.equal(hasAtmosphereEffect(THEME_SAKURA), true);
  assert.equal(hasAtmosphereEffect(THEME_YOZAKURA), true);
  assert.equal(hasAtmosphereEffect(THEME_LUNE_NEIGE), true);
  assert.equal(hasAtmosphereEffect(THEME_GALAXIE), true);
});

test("themeDefaultTypeface pairs each theme with a readable preset", () => {
  assert.equal(themeDefaultTypeface(THEME_INK), "sans");
  assert.equal(themeDefaultTypeface(THEME_NUIT), "sans");
  assert.equal(themeDefaultTypeface(THEME_PAPER), "classic");
  assert.equal(themeDefaultTypeface(THEME_SAKURA), "naskh");
  assert.equal(themeDefaultTypeface(THEME_YOZAKURA), "kufi");
  assert.equal(themeDefaultTypeface(THEME_LUNE_NEIGE), "sans");
  assert.equal(themeDefaultTypeface(THEME_GALAXIE), "sans");
});
