import { Capacitor } from "@capacitor/core";
import { fetchHtmlViaFlareSolverr } from "../../../server/lib/flareSolverr.js";
import { getFlareSolverrConfig } from "../../../server/lib/flareSolverrConfig.js";
import { configureSourceNativeFetch } from "../../../server/lib/nativeFetchBridge.js";
import { t } from "../../i18n/runtime.js";
import { fetchNativeHtmlWithCache, clearNativeHtmlCache } from "./nativeHtmlCache.js";
import { WEBVIEW_SOURCE_IDS } from "./webViewSources.js";

export { WEBVIEW_SOURCE_IDS, usesWebViewSource, shouldDeferCatalogFilters } from "./webViewSources.js";
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
const MAX_IMAGE_FETCH_CONCURRENCY = 3;
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
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await fetchNativeHtmlWithCache(async (targetUrl) => {
            try {
              const result = await MangalikHtmlFetcher.fetchHtml({ url: targetUrl });
              if (!result?.html) throw new Error(t("errors.loadPage"));
              return result.html;
            } catch (error) {
              if (!isCloudflareNativeError(error)) throw error;
              return fetchHtmlViaFlareSolverrIfConfigured(targetUrl);
            }
          }, url);
        } catch (error) {
          lastError = error;
          if (isCloudflareNativeError(error)) {
            try {
              return await fetchHtmlViaFlareSolverrIfConfigured(url);
            } catch (flareError) {
              lastError = flareError;
              break;
            }
          }
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 2500 * (attempt + 1)));
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
