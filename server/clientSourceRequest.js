import { handleSourceRequest as handleSourceRequestCore } from "./handler.js";

let nativeInitPromise = null;

async function ensureNativeSourceFetch() {
  const cap = globalThis.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  if (!nativeInitPromise) {
    nativeInitPromise = import("../src/lib/platform/mangalikNative.js")
      .then((module) => module.initCloudflareNative())
      .catch(() => {});
  }
  await nativeInitPromise;
}

/** Point d'entrée Capacitor / client — sans dépendances Node (stream, etc.). */
export async function handleSourceRequest(rawUrl, request = {}) {
  await ensureNativeSourceFetch();
  return handleSourceRequestCore(rawUrl, request);
}
