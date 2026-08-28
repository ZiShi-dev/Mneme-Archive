const LANDSCAPE_LOCK_TYPES = ["landscape", "landscape-primary", "landscape-secondary"];

export async function lockLandscapeOrientation() {
  const orientation = screen.orientation;
  if (!orientation?.lock) return false;

  for (const type of LANDSCAPE_LOCK_TYPES) {
    try {
      await orientation.lock(type);
      return true;
    } catch {
      // Try the next lock mode supported by the device/browser.
    }
  }

  return false;
}

export function unlockOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // Orientation unlock is best-effort across WebViews.
  }
}
