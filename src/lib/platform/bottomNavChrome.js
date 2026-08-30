export const BOTTOM_NAV_SCROLL_DELTA = 12;
export const BOTTOM_NAV_MIN_SCROLL_Y = 56;

export function resolveBottomNavScrollHidden({
  scrollTop,
  lastScrollTop,
  currentlyHidden,
  scrollDelta = BOTTOM_NAV_SCROLL_DELTA,
  minScrollY = BOTTOM_NAV_MIN_SCROLL_Y,
}) {
  const safeScrollTop = Math.max(0, scrollTop);
  const delta = safeScrollTop - lastScrollTop;

  if (safeScrollTop <= minScrollY) {
    return { hidden: false, lastScrollTop: safeScrollTop };
  }

  // Ignore tiny jitter so hide/show needs a clear gesture.
  if (Math.abs(delta) < scrollDelta) {
    return { hidden: currentlyHidden, lastScrollTop };
  }

  if (delta > 0) {
    return { hidden: true, lastScrollTop: safeScrollTop };
  }

  return { hidden: false, lastScrollTop: safeScrollTop };
}

export function shouldRevealBottomNavOnTap(target) {
  if (!target?.closest) return true;
  return !target.closest(
    "button, a, input, textarea, select, label, .bottom-nav, [role='button'], .catalog-filter-picker-backdrop, .catalog-source-picker-backdrop, .genre-picker-backdrop",
  );
}
