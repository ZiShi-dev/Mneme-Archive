import { Capacitor } from "@capacitor/core";
import { initNativeNotifications } from "./lib/notifications/nativeNotifications";
import { initSafeAreaInsets } from "./lib/platform/safeAreaInsets";
import { initSystemInsets } from "./lib/platform/systemInsets";
import { markNativeAppShell } from "./lib/platform/nativeAppLayout";

export async function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return;
  markNativeAppShell();
  initSystemInsets();
  initSafeAreaInsets();
  try {
    await initNativeNotifications();
  } catch {
    // Plugin optionnel selon la plateforme.
  }
}
