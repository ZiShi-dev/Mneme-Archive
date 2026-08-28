import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { initNativeNotifications } from "./lib/notifications/nativeNotifications";
import { initMangalikNative } from "./lib/platform/mangalikNative";

export async function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.classList.add("native-app");
  document.body.classList.add("native-app");
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#171218" });
    await initNativeNotifications();
    await initMangalikNative();
    await SplashScreen.hide();
  } catch {
    // Plugins optionnels selon la plateforme.
  }
}
