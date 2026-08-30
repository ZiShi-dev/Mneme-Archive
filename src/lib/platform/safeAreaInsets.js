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

  // Le haut est géré par MainActivity via --app-safe-area-top.
  // Le bas est poussé par MainActivity ; visualViewport ne sert qu'au clavier virtuel.
  const vpBottom = window.innerHeight - viewport.height - viewport.offsetTop;
  if (vpBottom > 150) {
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
