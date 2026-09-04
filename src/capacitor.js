import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { initNativeNotifications } from "./lib/notifications/nativeNotifications";
import { initSafeAreaInsets } from "./lib/platform/safeAreaInsets";

import { markNativeAppShell } from "./lib/platform/nativeAppLayout";

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
  // launchAutoHide est désactivé : masquer tout de suite pour ne pas bloquer le boot React.
  await hideNativeSplash();
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#090A12" });
    await initNativeNotifications();
    // WebView Cloudflare : init lazy via ensureCloudflareNative() au premier fetch catalogue.
  } catch {
    await hideNativeSplash();
  }
}
