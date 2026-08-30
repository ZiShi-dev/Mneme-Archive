import {
  THEME_INK,
  THEME_LUNE_NEIGE,
  THEME_PAPER,
  THEME_SAKURA,
  THEME_YOZAKURA,
  isDarkTheme,
  normalizeThemeId,
} from "../theme/appearance.js";

export const MNEME_MARK_PALETTES = {
  [THEME_INK]: {
    canvas: "#090A12",
    disk: "#151925",
    glyph: "#4B5168",
    glyphSoft: "#353A4E",
    ring: "#5A6178",
    node: "#727A92",
    star: "#F8F6F2",
    starGlow: "#8B7CFF",
  },
  [THEME_PAPER]: {
    canvas: "#F3F0EA",
    disk: "#EBE7DF",
    glyph: "#8A8494",
    glyphSoft: "#B4AEBC",
    ring: "#9C96A6",
    node: "#7E7888",
    star: "#FFFFFF",
    starGlow: "#5B47D6",
  },
  [THEME_SAKURA]: {
    canvas: "#FFF8F9",
    disk: "#FDEDEB",
    glyph: "#B88998",
    glyphSoft: "#D8B4C0",
    ring: "#C997A8",
    node: "#A66F82",
    star: "#FFFFFF",
    starGlow: "#E597B2",
  },
  [THEME_YOZAKURA]: {
    canvas: "#171218",
    disk: "#211920",
    glyph: "#6E5660",
    glyphSoft: "#4A3842",
    ring: "#8A6674",
    node: "#A67B8A",
    star: "#FFF5F8",
    starGlow: "#E8A8BA",
  },
  [THEME_LUNE_NEIGE]: {
    canvas: "#0D1522",
    disk: "#152033",
    glyph: "#5E7394",
    glyphSoft: "#3D4F68",
    ring: "#7A92B8",
    node: "#9AB4D8",
    star: "#F4F8FF",
    starGlow: "#8EB4E8",
  },
};

export function resolveMnemeMarkPalette(variant = "auto", appearance) {
  const themeId = normalizeThemeId(appearance);
  const base = MNEME_MARK_PALETTES[themeId] || MNEME_MARK_PALETTES[THEME_INK];

  if (variant === "light") {
    return isDarkTheme(themeId)
      ? MNEME_MARK_PALETTES[THEME_PAPER]
      : base;
  }

  if (variant === "dark") {
    return isDarkTheme(themeId)
      ? base
      : MNEME_MARK_PALETTES[THEME_INK];
  }

  if (typeof document !== "undefined" && !appearance) {
    const bodyTheme = document.body?.dataset?.theme;
    if (bodyTheme && MNEME_MARK_PALETTES[bodyTheme]) {
      return MNEME_MARK_PALETTES[bodyTheme];
    }
  }

  return base;
}
