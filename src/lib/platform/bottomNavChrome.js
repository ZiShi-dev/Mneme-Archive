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

  if (delta > scrollDelta) {
    return { hidden: true, lastScrollTop: safeScrollTop };
  }

  return { hidden: currentlyHidden, lastScrollTop: safeScrollTop };
}

export function shouldRevealBottomNavOnTap(target) {
  if (!target?.closest) return true;
  return !target.closest(
    "button, a, input, textarea, select, label, .bottom-nav, [role='button'], .catalog-filter-picker-backdrop, .catalog-source-picker-backdrop, .genre-picker-backdrop",
  );
}
