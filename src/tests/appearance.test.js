import test from "node:test";
import assert from "node:assert/strict";
import {
  isDarkTheme,
  isSakuraTheme,
  isSnowTheme,
  normalizeThemeId,
  THEME_INK,
  THEME_LUNE_NEIGE,
  THEME_PAPER,
  THEME_SAKURA,
  THEME_YOZAKURA,
} from "../lib/theme/appearance.js";

test("normalizeThemeId keeps known appearance ids", () => {
  assert.equal(normalizeThemeId("ink"), THEME_INK);
  assert.equal(normalizeThemeId("paper"), THEME_PAPER);
  assert.equal(normalizeThemeId("sakura"), THEME_SAKURA);
  assert.equal(normalizeThemeId("yozakura"), THEME_YOZAKURA);
  assert.equal(normalizeThemeId("lune-neige"), THEME_LUNE_NEIGE);
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

test("isDarkTheme treats ink, yozakura and lune-neige as dark", () => {
  assert.equal(isDarkTheme(THEME_INK), true);
  assert.equal(isDarkTheme(THEME_YOZAKURA), true);
  assert.equal(isDarkTheme(THEME_LUNE_NEIGE), true);
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
