import { addReaderScrollListener, getAppScrollElement } from "../platform/scrollRoot.js";

const CATALOG_TOAST_ESTIMATED_HEIGHT = 48;

export function readBottomChromeHeight() {
  if (typeof window === "undefined") return 0;

  const readerDock = document.querySelector(
    ".live-reader:not(.live-reader--video) .reader-episode-toolbar .reader-playback, .live-reader:not(.live-reader--video) .live-reader__dock:not(.live-reader__dock--hidden) .reader-playback",
  );
  if (readerDock) {
    const dockRect = readerDock.closest(".reader-episode-toolbar, .live-reader__dock")?.getBoundingClientRect();
    if (dockRect) {
      return Math.max(0, window.innerHeight - dockRect.top + 8);
    }
  }

  const bottomNav = document.querySelector(".bottom-nav");
  if (bottomNav) {
    const navRect = bottomNav.getBoundingClientRect();
    if (navRect.height > 0) {
      return Math.max(0, window.innerHeight - navRect.top + 8);
    }
  }

  const safeBottom = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom"),
  ) || 0;
  return Math.max(16, safeBottom + 16);
}

export function readTopChromeHeight() {
  if (typeof window === "undefined") return 16;

  const reader = document.querySelector(".live-reader:not(.live-reader--video), .live-reader--video");
  if (reader) {
    const header = reader.querySelector(".reader-episode-header, .reader-header");
    if (header) {
      const rect = header.getBoundingClientRect();
      return Math.max(16, rect.bottom + 8);
    }
    const safeTop = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--safe-top"),
    ) || 0;
    return Math.max(16, safeTop + 60);
  }

  const pageHeader = document.querySelector(".page-header");
  if (pageHeader) {
    const rect = pageHeader.getBoundingClientRect();
    if (rect.bottom > 0) {
      return Math.max(16, rect.bottom + 10);
    }
  }

  const frame = document.querySelector(".phone-frame, .app-shell__view");
  if (frame) {
    const rect = frame.getBoundingClientRect();
    if (rect.top > 0) {
      return Math.max(16, rect.top + 12);
    }
  }

  const safeTop = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--safe-top"),
  ) || 0;
  return Math.max(16, safeTop + 16);
}

export function measureToastStackInset() {
  if (typeof window === "undefined") {
    return { top: 16, bottom: 16, mode: "default" };
  }

  const reader = document.querySelector(".live-reader:not(.live-reader--video), .live-reader--video, .reader");
  return {
    top: readTopChromeHeight(),
    bottom: readBottomChromeHeight(),
    mode: reader ? "reader" : document.querySelector(".bottom-nav") ? "nav" : "default",
  };
}

/** Position du pill de chargement catalogue : tiers supérieur, jamais sur la barre du bas. */
export function computeCatalogLoadingToastTop(root = getAppScrollElement()) {
  if (typeof window === "undefined") return 88;

  const bottomReserve = readBottomChromeHeight();
  const maxTop = window.innerHeight - bottomReserve - CATALOG_TOAST_ESTIMATED_HEIGHT - 8;
  const minTop = readTopChromeHeight();

  let candidate;
  if (!root || typeof root.getBoundingClientRect !== "function") {
    candidate = Math.max(minTop, window.innerHeight * 0.18);
  } else {
    const rect = root.getBoundingClientRect();
    candidate = rect.top + Math.max(56, Math.min(rect.height * 0.2, 120));
    candidate = Math.max(candidate, minTop);
  }

  if (!Number.isFinite(maxTop) || maxTop <= minTop) {
    return minTop;
  }
  return Math.min(candidate, maxTop);
}

export function subscribeToastLayout(handler) {
  if (typeof window === "undefined") return () => {};
  let frame = 0;
  const sync = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      handler(measureToastStackInset());
    });
  };
  sync();
  window.addEventListener("resize", sync);
  window.addEventListener("nativeinsets", sync);
  const detachScroll = addReaderScrollListener(sync);
  const observer = typeof MutationObserver !== "undefined"
    ? new MutationObserver(sync)
    : null;
  const root = document.getElementById("root");
  if (observer && root) {
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-system-bars-visible"],
      subtree: true,
      childList: true,
    });
  }
  return () => {
    window.removeEventListener("resize", sync);
    window.removeEventListener("nativeinsets", sync);
    detachScroll();
    observer?.disconnect();
    if (frame) window.cancelAnimationFrame(frame);
  };
}
