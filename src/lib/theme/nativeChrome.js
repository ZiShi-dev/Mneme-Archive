import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isDarkTheme, normalizeThemeId, THEME_META_COLOR } from "./appearance.js";
import { resolveMnemeMarkPalette } from "../brand/mnemeMarkPalettes.js";

export async function syncNativeChrome(themeId, backgroundColor) {
  if (!Capacitor.isNativePlatform()) return;
  const appearance = normalizeThemeId(themeId);
  const palette = resolveMnemeMarkPalette("auto", appearance);
  const color = backgroundColor || palette.canvas || THEME_META_COLOR[appearance];
  const dark = isDarkTheme(appearance);
  try {
    await StatusBar.setBackgroundColor({ color });
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
  } catch {
    // Plugin optionnel selon la plateforme.
  }
}
