import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { isChromebookApp } from "./config/appFlavor";
import { initNativeNotifications } from "./lib/notifications/nativeNotifications";
import { initMangalikNative } from "./lib/platform/mangalikNative";
import { initSafeAreaInsets } from "./lib/platform/safeAreaInsets";

import { markNativeAppShell } from "./lib/platform/nativeAppLayout";
import { shouldSkipOnboarding } from "./lib/onboarding/constants";

export async function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return;
  markNativeAppShell();
  initSafeAreaInsets();
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#090A12" });
    await initNativeNotifications();
    if (!isChromebookApp) {
      await initMangalikNative();
    }
    if (shouldSkipOnboarding()) {
      await SplashScreen.hide();
    }
  } catch {
    // Plugins optionnels selon la plateforme.
  }
}
