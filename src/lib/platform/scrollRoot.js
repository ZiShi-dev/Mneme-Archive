function isWindowScrollRoot(root) {
  return !root
    || root === document.documentElement
    || root === document.body
    || root === document.scrollingElement;
}

export function getStandaloneReaderElement() {
  if (typeof document === "undefined") return null;
  return document.querySelector("#root > .live-reader:not(.live-reader--video), #root > .reader");
}

export function getAppScrollElement() {
  if (typeof document === "undefined") return null;

  const standaloneReader = getStandaloneReaderElement();
  if (standaloneReader && document.documentElement.classList.contains("native-app")) {
    return standaloneReader;
  }

  const frame = document.querySelector(".phone-frame, .app-shell__view");
  const usesFrameScroller = document.documentElement.classList.contains("desktop-app")
    || document.documentElement.classList.contains("native-app");
  if (usesFrameScroller && frame) {
    return frame;
  }
  return document.scrollingElement || document.documentElement;
}

export function getReaderScrollElement() {
  return getAppScrollElement();
}

export function getScrollTop(root = getReaderScrollElement()) {
  if (!root) return 0;
  if (isWindowScrollRoot(root)) return window.scrollY || 0;
  return root.scrollTop || 0;
}

export function getScrollViewportHeight(root = getReaderScrollElement()) {
  if (!root) return window.innerHeight;
  if (isWindowScrollRoot(root)) return window.innerHeight;
  return root.clientHeight;
}

export function getScrollHeight(root = getReaderScrollElement()) {
  if (!root) return document.documentElement.scrollHeight;
  if (isWindowScrollRoot(root)) return document.documentElement.scrollHeight;
  return root.scrollHeight;
}

export function getMaxScrollTop(root = getReaderScrollElement()) {
  return Math.max(0, getScrollHeight(root) - getScrollViewportHeight(root));
}

export function scrollReaderTo(top, { behavior = "auto", root = getReaderScrollElement() } = {}) {
  if (!root) return;
  const nextTop = Math.max(0, top);
  if (isWindowScrollRoot(root)) {
    window.scrollTo({ top: nextTop, left: 0, behavior });
    return;
  }
  root.scrollTo({ top: nextTop, left: 0, behavior });
}

export function scrollReaderBy(deltaY, { root = getReaderScrollElement() } = {}) {
  if (!root) return;
  if (isWindowScrollRoot(root)) {
    window.scrollBy(0, deltaY);
    return;
  }
  root.scrollTop += deltaY;
}

export function addReaderScrollListener(handler, { passive = true } = {}) {
  const root = getReaderScrollElement();
  if (!root) return () => {};
  if (isWindowScrollRoot(root)) {
    window.addEventListener("scroll", handler, { passive });
    return () => window.removeEventListener("scroll", handler);
  }
  root.addEventListener("scroll", handler, { passive });
  return () => root.removeEventListener("scroll", handler);
}

export function scrollAppToTop({ behavior = "auto" } = {}) {
  scrollReaderTo(0, { behavior });
}

export function scrollAppToElement(target, { behavior = "auto", offset = 12 } = {}) {
  if (!target) return;
  const root = getAppScrollElement();
  if (!root) return;

  if (isWindowScrollRoot(root)) {
    const top = window.scrollY + target.getBoundingClientRect().top - offset;
    window.scrollTo({ top: Math.max(0, top), behavior });
    return;
  }

  const rootRect = root.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const top = targetRect.top - rootRect.top + root.scrollTop - offset;
  root.scrollTo({ top: Math.max(0, top), behavior });
}
