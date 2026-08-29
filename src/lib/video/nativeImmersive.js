import { Capacitor, registerPlugin } from "@capacitor/core";

const ImmersiveMode = registerPlugin("ImmersiveMode");

export async function setNativeImmersive(active) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar } = await import("@capacitor/status-bar");
    if (active) {
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.hide();
      await ImmersiveMode.enter();
    } else {
      await ImmersiveMode.exit();
      await StatusBar.show();
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  } catch {
    // Plugins optionnels selon la plateforme.
  }
}
