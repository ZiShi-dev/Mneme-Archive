import { Capacitor } from "@capacitor/core";
import { configureMangalikNativeFetch } from "../../../server/sources/mangalik.js";
import { t } from "../../i18n/runtime.js";

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function createCloudflareNativeFetchers() {
  const { MangalikHtmlFetcher } = await import("../../plugins/mangalikHtmlFetcher.js");
  return {
    fetchHtml: async (url) => {
      const result = await MangalikHtmlFetcher.fetchHtml({ url });
      if (!result?.html) throw new Error(t("errors.loadPage"));
      return result.html;
    },
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

let mangalikNativeReady = false;

export async function initMangalikNative() {
  if (!Capacitor.isNativePlatform() || mangalikNativeReady) return;
  configureMangalikNativeFetch(await createCloudflareNativeFetchers());
  mangalikNativeReady = true;
}

export async function initCloudflareNative() {
  return initMangalikNative();
}
