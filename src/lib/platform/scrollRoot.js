export function getAppScrollElement() {
  if (typeof document === "undefined") return null;
  const frame = document.querySelector(".phone-frame");
  if (document.documentElement.classList.contains("desktop-app") && frame) {
    if (frame.scrollHeight > frame.clientHeight + 1) return frame;
  }
  return document.scrollingElement || document.documentElement;
}

export function scrollAppToTop({ behavior = "auto" } = {}) {
  if (typeof document === "undefined") return;
  const frame = document.documentElement.classList.contains("desktop-app")
    ? document.querySelector(".phone-frame")
    : null;
  if (frame) {
    frame.scrollTo({ top: 0, behavior });
    return;
  }
  window.scrollTo({ top: 0, behavior });
}

export function scrollAppToElement(target, { behavior = "auto", offset = 12 } = {}) {
  if (!target) return;
  const root = getAppScrollElement();
  if (!root) return;

  if (root === document.scrollingElement || root === document.documentElement || root === document.body) {
    const top = window.scrollY + target.getBoundingClientRect().top - offset;
    window.scrollTo({ top: Math.max(0, top), behavior });
    return;
  }

  const rootRect = root.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const top = targetRect.top - rootRect.top + root.scrollTop - offset;
  root.scrollTo({ top: Math.max(0, top), behavior });
}
