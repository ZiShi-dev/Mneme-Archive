import { Capacitor } from "@capacitor/core";

function setInset(name, value) {
  document.documentElement.style.setProperty(name, `${Math.max(0, Math.round(value))}px`);
}

function readInsetValue(name) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

function readFromVisualViewport() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const vpTop = viewport.offsetTop;
  setInset("--app-safe-area-top", Math.max(readInsetValue("--app-safe-area-top"), vpTop));

  // Ne pas gonfler le bas avec visualViewport (navigation gestuelle) — seulement clavier.
  const vpBottom = window.innerHeight - viewport.height - viewport.offsetTop;
  if (vpBottom > 48) {
    setInset("--app-safe-area-bottom", Math.max(readInsetValue("--app-safe-area-bottom"), vpBottom));
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

  return () => {
    window.visualViewport?.removeEventListener("resize", update);
    window.visualViewport?.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
  };
}
