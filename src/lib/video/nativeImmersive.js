import { Capacitor, registerPlugin } from "@capacitor/core";

const ImmersiveMode = registerPlugin("ImmersiveMode");
const IMMERSIVE_CLASS = "app-immersive-fullscreen";

function setImmersiveDomClass(active) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(IMMERSIVE_CLASS, Boolean(active));
  document.body?.classList.toggle(IMMERSIVE_CLASS, Boolean(active));
}

export async function setNativeImmersive(active) {
  if (!Capacitor.isNativePlatform()) {
    setImmersiveDomClass(active);
    return;
  }

  try {
    const { StatusBar } = await import("@capacitor/status-bar");
    if (active) {
      setImmersiveDomClass(true);
      // Overlay reste true (edge-to-edge) pour que le média couvre la barre info.
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.hide();
      await ImmersiveMode.enter();
    } else {
      // Retirer la classe tout de suite : sinon le lecteur (z-index 180) reste
      // au-dessus des sheets (portal ~150) et bloque recherche / filtres.
      setImmersiveDomClass(false);
      await ImmersiveMode.exit();
      await StatusBar.show();
      // Garder overlay pour ne pas casser le layout safe-area de l'app.
      await StatusBar.setOverlaysWebView({ overlay: true });
    }
  } catch {
    setImmersiveDomClass(active);
  }
}
