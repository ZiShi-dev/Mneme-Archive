export const THEME_INK = "ink";
export const THEME_PAPER = "paper";
export const THEME_SAKURA = "sakura";
export const THEME_YOZAKURA = "yozakura";

export const THEME_IDS = [THEME_INK, THEME_PAPER, THEME_SAKURA, THEME_YOZAKURA];

export const THEME_META_COLOR = {
  [THEME_INK]: "#090A12",
  [THEME_PAPER]: "#F3F0EA",
  [THEME_SAKURA]: "#FFF8F9",
  [THEME_YOZAKURA]: "#171218",
};

export function normalizeThemeId(value) {
  if (value === THEME_INK || value === THEME_PAPER || value === THEME_SAKURA || value === THEME_YOZAKURA) {
    return value;
  }
  if (value === "usuzakura") return THEME_SAKURA;
  if (value === "kurozakura") return THEME_INK;
  if (value === false || value === "false" || value === 0) return THEME_PAPER;
  if (value === true || value === "true" || value === 1) return THEME_INK;
  return THEME_INK;
}

export function isDarkTheme(themeId) {
  const id = normalizeThemeId(themeId);
  return id === THEME_INK || id === THEME_YOZAKURA;
}

export function isSakuraTheme(themeId) {
  const id = normalizeThemeId(themeId);
  return id === THEME_SAKURA || id === THEME_YOZAKURA;
}

export function themeNameKey(themeId) {
  const id = normalizeThemeId(themeId);
  if (id === THEME_PAPER) return "settings.themePapier";
  if (id === THEME_SAKURA) return "settings.themeSakura";
  if (id === THEME_YOZAKURA) return "settings.themeYozakura";
  return "settings.themeEncre";
}

export function themeHintKey(themeId) {
  const id = normalizeThemeId(themeId);
  if (id === THEME_PAPER) return "settings.themePapierHint";
  if (id === THEME_SAKURA) return "settings.themeSakuraHint";
  if (id === THEME_YOZAKURA) return "settings.themeYozakuraHint";
  return "settings.themeEncreHint";
}

export function applyAppearance(themeId) {
  if (typeof document === "undefined") return;
  const id = normalizeThemeId(themeId);
  document.documentElement.style.colorScheme = isDarkTheme(id) ? "dark" : "light";
  document.body.dataset.theme = id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_META_COLOR[id]);
}
