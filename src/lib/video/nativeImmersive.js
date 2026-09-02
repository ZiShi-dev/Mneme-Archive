import { Capacitor, registerPlugin } from "@capacitor/core";

const ImmersiveMode = registerPlugin("ImmersiveMode");
const IMMERSIVE_CLASS = "app-immersive-fullscreen";

let statusBarModulePromise = null;
let desired = null;
let applied = null;
let inflight = Promise.resolve();

function getStatusBarModule() {
  if (!statusBarModulePromise) {
    statusBarModulePromise = import("@capacitor/status-bar");
  }
  return statusBarModulePromise;
}

function setImmersiveDomClass(active) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(IMMERSIVE_CLASS, Boolean(active));
  document.body?.classList.toggle(IMMERSIVE_CLASS, Boolean(active));
}

export async function setNativeImmersive(active) {
  const next = Boolean(active);
  desired = next;
  setImmersiveDomClass(next);

  if (!Capacitor.isNativePlatform()) {
    applied = next;
    return;
  }

  if (applied === next) return;

  inflight = inflight.then(async () => {
    const target = desired;
    if (applied === target) return;
    try {
      const { StatusBar } = await getStatusBarModule();
      if (target) {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.hide();
        await ImmersiveMode.enter();
      } else {
        await ImmersiveMode.exit();
        await StatusBar.show();
        await StatusBar.setOverlaysWebView({ overlay: true });
      }
      applied = target;
    } catch {
      setImmersiveDomClass(desired);
    }
  });

  await inflight;
}
