export const THEME_INK = "ink";
export const THEME_NUIT = "nuit";
export const THEME_PAPER = "paper";
export const THEME_SAKURA = "sakura";
export const THEME_YOZAKURA = "yozakura";
export const THEME_LUNE_NEIGE = "lune-neige";
export const THEME_GALAXIE = "galaxie";

export const THEME_IDS = [
  THEME_INK,
  THEME_NUIT,
  THEME_PAPER,
  THEME_SAKURA,
  THEME_YOZAKURA,
  THEME_LUNE_NEIGE,
  THEME_GALAXIE,
];

export const THEME_META_COLOR = {
  [THEME_INK]: "#090A12",
  [THEME_NUIT]: "#000000",
  [THEME_PAPER]: "#F3F0EA",
  [THEME_SAKURA]: "#FFF8F9",
  [THEME_YOZAKURA]: "#171218",
  [THEME_LUNE_NEIGE]: "#0D1522",
  [THEME_GALAXIE]: "#07061A",
};

export function normalizeThemeId(value) {
  if (
    value === THEME_INK
    || value === THEME_NUIT
    || value === THEME_PAPER
    || value === THEME_SAKURA
    || value === THEME_YOZAKURA
    || value === THEME_LUNE_NEIGE
    || value === THEME_GALAXIE
  ) {
    return value;
  }
  if (value === "usuzakura") return THEME_SAKURA;
  if (value === "kurozakura") return THEME_INK;
  if (value === "galaxy" || value === "cosmos") return THEME_GALAXIE;
  if (value === false || value === "false" || value === 0) return THEME_PAPER;
  if (value === true || value === "true" || value === 1) return THEME_INK;
  return THEME_INK;
}

export function isDarkTheme(themeId) {
  const id = normalizeThemeId(themeId);
  return id === THEME_INK || id === THEME_NUIT || id === THEME_YOZAKURA || id === THEME_LUNE_NEIGE || id === THEME_GALAXIE;
}
