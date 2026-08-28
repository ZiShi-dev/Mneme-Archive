import { PRELOAD_MAX_CONCURRENT, PRELOAD_PAGES_MAX, PRELOAD_PAGES_MIN } from "../settings/defaults";
import { getPreloadNetworkStatus, isWifiLikeConnection, refreshNetworkStatus } from "../platform/networkStatus";
import { resolveSourceImageUrl } from "../../features/sources/sourceApi";

export { getPreloadNetworkStatus, isWifiLikeConnection, refreshNetworkStatus };

const preloadedKeys = new Set();
let activePreloads = 0;
const preloadWaiters = [];

function clampPreloadCount(value) {
  return Math.max(PRELOAD_PAGES_MIN, Math.min(PRELOAD_PAGES_MAX, Number(value) || 3));
}

function acquirePreloadSlot(signal) {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  if (activePreloads < PRELOAD_MAX_CONCURRENT) {
    activePreloads += 1;
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const waiter = {
      resolve: () => {
        signal?.removeEventListener("abort", onAbort);
        activePreloads += 1;
        resolve();
      },
      reject,
    };

    const onAbort = () => {
      const index = preloadWaiters.indexOf(waiter);
      if (index >= 0) preloadWaiters.splice(index, 1);
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    preloadWaiters.push(waiter);
  });
}

function releasePreloadSlot() {
  activePreloads = Math.max(0, activePreloads - 1);
  preloadWaiters.shift()?.resolve();
}

export function resetPagePreloadCache() {
  preloadedKeys.clear();
  preloadWaiters.splice(0, preloadWaiters.length);
  activePreloads = 0;
}

export function canPreloadPages({ preload = true, wifiOnly = false } = {}) {
  if (!preload) return false;
  if (wifiOnly && !isWifiLikeConnection()) return false;
  return true;
}

export async function preloadSourcePage(sourceId, pageSrc, signal) {
  if (signal?.aborted) return;

  const key = `${sourceId}:${pageSrc}`;
  if (preloadedKeys.has(key)) return;

  await acquirePreloadSlot(signal);
  if (signal?.aborted) {
    releasePreloadSlot();
    return;
  }

  preloadedKeys.add(key);

  try {
    const url = await resolveSourceImageUrl(sourceId, pageSrc);
    if (!url || signal?.aborted) return;

    await new Promise((resolve, reject) => {
      const image = new Image();
      image.referrerPolicy = "no-referrer";

      const onAbort = () => {
        image.src = "";
        reject(new DOMException("Aborted", "AbortError"));
      };

      signal?.addEventListener("abort", onAbort, { once: true });
      image.onload = () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      };
      image.onerror = () => {
        signal?.removeEventListener("abort", onAbort);
        reject(new Error("preload failed"));
      };
      image.src = url;
    });
  } catch {
    preloadedKeys.delete(key);
  } finally {
    releasePreloadSlot();
  }
}

export function preloadPagesAhead({ sourceId, pages, visibleIndex, count, signal }) {
  const limit = clampPreloadCount(count);
  for (let offset = 1; offset <= limit; offset += 1) {
    if (signal?.aborted) break;
    const page = pages[visibleIndex + offset];
    if (!page?.src) break;
    void preloadSourcePage(sourceId, page.src, signal);
  }
}
