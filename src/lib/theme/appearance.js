import { applyThemeIcons } from "./themeIcons.js";
import { peekStorageString } from "../storage/peek.js";
import { isKvStoreReady, kvGetStringSync, kvHasSync } from "../storage/kvStore.js";
import {
  THEME_INK,
  THEME_NUIT,
  THEME_PAPER,
  THEME_SAKURA,
  THEME_YOZAKURA,
  THEME_LUNE_NEIGE,
  THEME_GALAXIE,
  THEME_IDS,
  THEME_META_COLOR,
  normalizeThemeId,
  isDarkTheme,
} from "./themeIds.js";

export {
  THEME_INK,
  THEME_NUIT,
  THEME_PAPER,
  THEME_SAKURA,
  THEME_YOZAKURA,
  THEME_LUNE_NEIGE,
  THEME_GALAXIE,
  THEME_IDS,
  THEME_META_COLOR,
  normalizeThemeId,
  isDarkTheme,
};

const THEME_DEFAULT_TYPEFACE = {
  [THEME_INK]: "sans",
  [THEME_NUIT]: "sans",
  [THEME_PAPER]: "classic",
  [THEME_SAKURA]: "naskh",
  [THEME_YOZAKURA]: "kufi",
  [THEME_LUNE_NEIGE]: "sans",
  [THEME_GALAXIE]: "sans",
};

export function themeDefaultTypeface(themeId) {
  return THEME_DEFAULT_TYPEFACE[normalizeThemeId(themeId)] || "sans";
}

export function isSakuraTheme(themeId) {
  const id = normalizeThemeId(themeId);
  return id === THEME_SAKURA || id === THEME_YOZAKURA;
}

export function isSnowTheme(themeId) {
  return normalizeThemeId(themeId) === THEME_LUNE_NEIGE;
}

export function isGalaxyTheme(themeId) {
  return normalizeThemeId(themeId) === THEME_GALAXIE;
}

export function hasAtmosphereEffect(themeId) {
  const id = normalizeThemeId(themeId);
  return (
    id === THEME_SAKURA
    || id === THEME_YOZAKURA
    || id === THEME_LUNE_NEIGE
    || id === THEME_INK
    || id === THEME_PAPER
    || id === THEME_GALAXIE
  );
}

export function themeNameKey(themeId) {
  const id = normalizeThemeId(themeId);
  if (id === THEME_PAPER) return "settings.themePapier";
  if (id === THEME_NUIT) return "settings.themeNuit";
  if (id === THEME_SAKURA) return "settings.themeSakura";
  if (id === THEME_YOZAKURA) return "settings.themeYozakura";
  if (id === THEME_LUNE_NEIGE) return "settings.themeLuneNeige";
  if (id === THEME_GALAXIE) return "settings.themeGalaxie";
  return "settings.themeEncre";
}

export function themeHintKey(themeId) {
  const id = normalizeThemeId(themeId);
  if (id === THEME_PAPER) return "settings.themePapierHint";
  if (id === THEME_NUIT) return "settings.themeNuitHint";
  if (id === THEME_SAKURA) return "settings.themeSakuraHint";
  if (id === THEME_YOZAKURA) return "settings.themeYozakuraHint";
  if (id === THEME_LUNE_NEIGE) return "settings.themeLuneNeigeHint";
  if (id === THEME_GALAXIE) return "settings.themeGalaxieHint";
  return "settings.themeEncreHint";
}

export function themeSheetModifier(themeId) {
  return normalizeThemeId(themeId);
}

export function applyAppearance(themeId) {
  if (typeof document === "undefined") return;
  const id = normalizeThemeId(themeId);
  const background = THEME_META_COLOR[id] || THEME_META_COLOR[THEME_INK];
  document.documentElement.style.colorScheme = isDarkTheme(id) ? "dark" : "light";
  document.documentElement.style.setProperty("--boot-shell-bg", background);
  document.documentElement.style.backgroundColor = background;
  document.documentElement.dataset.theme = id;
  if (document.body) {
    document.body.dataset.theme = id;
    document.body.style.backgroundColor = background;
    document.body.style.color = isDarkTheme(id) ? "#f6f7f8" : "#171218";
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background);
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute(
    "content",
    isDarkTheme(id) ? "black-translucent" : "default",
  );
  applyThemeIcons(id);
}

function readAppearanceFromLocalStorage() {
  const appearanceRaw = peekStorageString("living-archive:appearance", "");
  if (appearanceRaw) return normalizeThemeId(appearanceRaw);
  try {
    const inkMode = JSON.parse(peekStorageString("living-archive:ink-mode", "true"));
    return normalizeThemeId(inkMode);
  } catch {
    return THEME_INK;
  }
}

function readAppearanceFromKvCache() {
  if (!isKvStoreReady()) return null;
  const appearanceRaw = kvGetStringSync("living-archive:appearance", "");
  if (appearanceRaw) return normalizeThemeId(appearanceRaw);
  if (kvHasSync("living-archive:ink-mode")) {
    const inkRaw = kvGetStringSync("living-archive:ink-mode", "true");
    try {
      return normalizeThemeId(JSON.parse(inkRaw));
    } catch {
      return normalizeThemeId(inkRaw);
    }
  }
  return null;
}

export function readBootAppearance() {
  return readAppearanceFromKvCache() ?? readAppearanceFromLocalStorage();
}
