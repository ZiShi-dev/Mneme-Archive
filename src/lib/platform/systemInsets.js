import { Capacitor } from "@capacitor/core";

const NAV_MODES = new Set(["buttons", "gesture"]);

let lastNativeInsets = null;

function scheduleNativeChromeSync() {
  void import("../theme/nativeChrome.js")
    .then(({ syncNativeChrome }) => import("../theme/appearance.js")
      .then(({ readBootAppearance }) => syncNativeChrome(readBootAppearance())))
    .catch(() => {});
}

export function applyNativeInsets({
  top = 0,
  bottom = 0,
  left = 0,
  right = 0,
  navMode = "",
  systemBarsVisible = true,
} = {}) {
  const root = document.documentElement;
  const safeTop = Math.max(0, Math.round(top));
  const safeBottom = Math.max(0, Math.round(bottom));
  const safeLeft = Math.max(0, Math.round(left));
  const safeRight = Math.max(0, Math.round(right));

  lastNativeInsets = { top: safeTop, bottom: safeBottom, left: safeLeft, right: safeRight };

  root.style.setProperty("--app-safe-area-top", `${safeTop}px`);
  root.style.setProperty("--app-safe-area-bottom", `${safeBottom}px`);
  root.style.setProperty("--app-safe-area-left", `${safeLeft}px`);
  root.style.setProperty("--app-safe-area-right", `${safeRight}px`);

  if (NAV_MODES.has(navMode)) {
    root.dataset.navMode = navMode;
  }

  root.dataset.systemBarsVisible = systemBarsVisible ? "true" : "false";

  scheduleNativeChromeSync();

  window.dispatchEvent(new CustomEvent("nativeinsets", {
    detail: {
      top: safeTop,
      bottom: safeBottom,
      left: safeLeft,
      right: safeRight,
      navMode: NAV_MODES.has(navMode) ? navMode : readNativeNavMode(),
      systemBarsVisible,
    },
  }));
}

export function readLastNativeInsets() {
  return lastNativeInsets;
}

export function readNativeNavMode() {
  const mode = document.documentElement.dataset.navMode;
  return NAV_MODES.has(mode) ? mode : "buttons";
}

export function isButtonNavMode() {
  return readNativeNavMode() === "buttons";
}

export function initSystemInsets() {
  if (!Capacitor.isNativePlatform()) return undefined;
  if (typeof window.__applyNativeInsets === "function") return undefined;

  window.__applyNativeInsets = applyNativeInsets;

  return () => {
    delete window.__applyNativeInsets;
  };
}
