import { Capacitor } from "@capacitor/core";
import { configureMangalikNativeFetch } from "../../../server/sources/mangalik.js";
import { configureHentaireadNativeFetch } from "../../../server/sources/hentairead.js";
import { configureAzoraflyNativeFetch } from "../../../server/sources/azorafly.js";
import { configureGalaxynovelsNativeFetch } from "../../../server/sources/galaxynovels.js";
import { t } from "../../i18n/runtime.js";

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

let htmlFetchChain = Promise.resolve();

function queueHtmlFetch(run) {
  const next = htmlFetchChain.then(run);
  htmlFetchChain = next.catch(() => {});
  return next;
}

async function createCloudflareNativeFetchers() {
  const { MangalikHtmlFetcher } = await import("../../plugins/mangalikHtmlFetcher.js");
  return {
    fetchHtml: async (url) => queueHtmlFetch(async () => {
      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const result = await MangalikHtmlFetcher.fetchHtml({ url });
          if (!result?.html) throw new Error(t("errors.loadPage"));
          return result.html;
        } catch (error) {
          lastError = error;
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }
      throw lastError ?? new Error(t("errors.loadPage"));
    }),
    fetchImage: async (url) => {
      const result = await MangalikHtmlFetcher.fetchImage({ url });
      if (!result?.base64) throw new Error(t("errors.loadImage"));
      return {
        kind: "image",
        contentType: result.contentType || "image/jpeg",
        buffer: decodeBase64(result.base64),
      };
    },
  };
}

let cloudflareNativeReady = false;

export async function initCloudflareNative() {
  if (!Capacitor.isNativePlatform() || cloudflareNativeReady) return;
  const fetchers = await createCloudflareNativeFetchers();
  configureMangalikNativeFetch(fetchers);
  configureHentaireadNativeFetch(fetchers);
  configureAzoraflyNativeFetch(fetchers);
  configureGalaxynovelsNativeFetch(fetchers);
  cloudflareNativeReady = true;
}

export async function initMangalikNative() {
  return initCloudflareNative();
}
