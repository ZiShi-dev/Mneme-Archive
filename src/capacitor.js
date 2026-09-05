import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { initNativeNotifications } from "./lib/notifications/nativeNotifications";
import { initSafeAreaInsets } from "./lib/platform/safeAreaInsets";
import { markNativeAppShell } from "./lib/platform/nativeAppLayout";
import { isDarkTheme, readBootAppearance, THEME_META_COLOR } from "./lib/theme/appearance";
import { resolveMnemeMarkPalette } from "./lib/brand/mnemeMarkPalettes.js";

async function hideNativeSplash() {
  try {
    await SplashScreen.hide();
  } catch {
    // Plugin optionnel selon la plateforme.
  }
}

export async function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return;
  markNativeAppShell();
  initSafeAreaInsets();
  // launchAutoHide est désactivé : masquer tout de suite pour ne pas laisser un écran vide.
  await hideNativeSplash();
  const appearance = readBootAppearance();
  const palette = resolveMnemeMarkPalette("auto", appearance);
  const dark = isDarkTheme(appearance);
  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: palette.canvas || THEME_META_COLOR[appearance] });
    await initNativeNotifications();
  } catch {
    await hideNativeSplash();
  }
}
