import { Capacitor } from "@capacitor/core";
import { readLastNativeInsets } from "./systemInsets.js";

function setInset(name, value) {
  document.documentElement.style.setProperty(name, `${Math.max(0, Math.round(value))}px`);
}

function readInsetValue(name) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

function readNativeBottom() {
  return readLastNativeInsets()?.bottom ?? readInsetValue("--app-safe-area-bottom");
}

function readFromVisualViewport() {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const vpBottom = window.innerHeight - viewport.height - viewport.offsetTop;
  if (vpBottom > 150) {
    setInset("--app-safe-area-bottom", Math.max(readNativeBottom(), vpBottom));
    return;
  }

  const native = readLastNativeInsets();
  if (native) {
    setInset("--app-safe-area-bottom", native.bottom);
  }
}

export function initSafeAreaInsets() {
  if (!Capacitor.isNativePlatform()) return undefined;

  const update = () => readFromVisualViewport();
  update();
  window.visualViewport?.addEventListener("resize", update);
  window.visualViewport?.addEventListener("scroll", update);
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", () => window.setTimeout(update, 120));
  window.addEventListener("nativeinsets", update);

  return () => {
    window.visualViewport?.removeEventListener("resize", update);
    window.visualViewport?.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
    window.removeEventListener("nativeinsets", update);
  };
}
