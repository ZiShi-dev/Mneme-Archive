export const APP_PULL_REFRESH = "manhaw:pull-refresh";

async function clearAppDataCaches() {
  try {
    const { clearSourceApiCache } = await import("../../features/sources/sourceApi.js");
    clearSourceApiCache();
  } catch {
    // Source API may be unavailable during startup.
  }

  try {
    const { clearHomeLatestChaptersCache } = await import("../updates/homeLatestChapters.js");
    clearHomeLatestChaptersCache();
  } catch {
    // Home latest cache is optional.
  }

  if (typeof window === "undefined") return;

  try {
    const { clearNativeHtmlCache } = await import("./nativeHtmlCache.js");
    clearNativeHtmlCache();
  } catch {
    // Native HTML cache is optional.
  }
}

/** Déclenche un rafraîchissement global (caches + écrans actifs). */
export async function runAppPullRefresh({ reloadIfUnhandled = false } = {}) {
  await clearAppDataCaches();

  const detail = { handled: false, tasks: [] };
  document.dispatchEvent(new CustomEvent(APP_PULL_REFRESH, { detail }));

  if (detail.tasks.length > 0) {
    await Promise.allSettled(detail.tasks);
    detail.handled = true;
  }

  if (!detail.handled && reloadIfUnhandled) {
    window.location.reload();
  }
}
