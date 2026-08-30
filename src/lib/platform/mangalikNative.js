import { Capacitor } from "@capacitor/core";
import { fetchHtmlViaFlareSolverr } from "../../../server/lib/flareSolverr.js";
import { getFlareSolverrConfig } from "../../../server/lib/flareSolverrConfig.js";
import { configureSourceNativeFetch } from "../../../server/lib/nativeFetchBridge.js";
import { t } from "../../i18n/runtime.js";
import { fetchNativeHtmlWithCache, clearNativeHtmlCache } from "./nativeHtmlCache.js";

export { WEBVIEW_SOURCE_IDS, usesWebViewSource, usesFlareDirectSource, shouldDeferCatalogFilters } from "./webViewSources.js";
export { clearNativeHtmlCache, invalidateNativeHtmlCache, normalizeNativeHtmlUrl } from "./nativeHtmlCache.js";

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

let htmlFetchChain = Promise.resolve();
let imageFetchChain = Promise.resolve();
const MAX_IMAGE_FETCH_CONCURRENCY = 5;
let activeImageFetches = 0;
const pendingImageResolvers = [];

function queueHtmlFetch(run) {
  const next = htmlFetchChain.then(run);
  htmlFetchChain = next.catch(() => {});
  return next;
}

function pumpImageQueue() {
  while (activeImageFetches < MAX_IMAGE_FETCH_CONCURRENCY && pendingImageResolvers.length) {
    const next = pendingImageResolvers.shift();
    if (next) next();
  }
}

function queueImageFetch(run) {
  return new Promise((resolve, reject) => {
    const start = () => {
      activeImageFetches += 1;
      run()
        .then(resolve, reject)
        .finally(() => {
          activeImageFetches -= 1;
          pumpImageQueue();
        });
    };
    if (activeImageFetches < MAX_IMAGE_FETCH_CONCURRENCY) {
      start();
      return;
    }
    pendingImageResolvers.push(start);
  });
}

function isCloudflareNativeError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /cancelled|cloudflare|حماية/i.test(message);
}

async function fetchHtmlViaFlareSolverrIfConfigured(url) {
  const config = getFlareSolverrConfig();
  if (!config?.baseUrl) {
    throw new Error(t("errors.flareSolverrMissing"));
  }
  return fetchHtmlViaFlareSolverr(url, config);
}

async function createCloudflareNativeFetchers() {
  const { MangalikHtmlFetcher } = await import("../../plugins/mangalikHtmlFetcher.js");
  return {
    fetchHtml: async (url) => queueHtmlFetch(async () => {
      let lastError = null;
      // Flare d’abord : le HTTP natif tombe souvent sur CF et coûte plusieurs secondes.
      try {
        return await fetchNativeHtmlWithCache(
          (targetUrl) => fetchHtmlViaFlareSolverrIfConfigured(targetUrl),
          url,
        );
      } catch (flareFirstError) {
        lastError = flareFirstError;
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          return await fetchNativeHtmlWithCache(async (targetUrl) => {
            const result = await MangalikHtmlFetcher.fetchHtml({ url: targetUrl });
            if (!result?.html) throw new Error(t("errors.loadPage"));
            return result.html;
          }, url);
        } catch (error) {
          lastError = error;
          if (attempt < 1) {
            await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
          }
        }
      }
      throw lastError ?? new Error(t("errors.loadPage"));
    }),
    fetchImage: async (url) => queueImageFetch(async () => {
      const result = await MangalikHtmlFetcher.fetchImage({ url });
      if (!result?.base64) throw new Error(t("errors.loadImage"));
      return {
        kind: "image",
        contentType: result.contentType || "image/jpeg",
        buffer: decodeBase64(result.base64),
      };
    }),
  };
}

let cloudflareNativeReady = false;

export async function initCloudflareNative() {
  if (!Capacitor.isNativePlatform() || cloudflareNativeReady) return;
  const fetchers = await createCloudflareNativeFetchers();
  configureSourceNativeFetch(fetchers);
  cloudflareNativeReady = true;
}

export async function initMangalikNative() {
  return initCloudflareNative();
}

export async function cancelCloudflarePending() {
  if (!Capacitor.isNativePlatform()) return;
  htmlFetchChain = Promise.resolve();
  clearNativeHtmlCache();
  try {
    const { MangalikHtmlFetcher } = await import("../../plugins/mangalikHtmlFetcher.js");
    await MangalikHtmlFetcher.cancelPending();
  } catch {
    // Native plugin may be unavailable during startup.
  }
  try {
    const { ParadiseChapterFetcher } = await import("../../plugins/paradiseChapterFetcher.js");
    await ParadiseChapterFetcher.cancelPending();
  } catch {
    // Paradise fetcher is optional for catalog source switches.
  }
}
