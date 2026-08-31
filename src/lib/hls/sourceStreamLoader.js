import { Capacitor } from "@capacitor/core";
import { FetchLoader } from "hls.js";
import { t } from "../../i18n/runtime.js";

const isNative = () => Capacitor.isNativePlatform();
const useSourceBridge = () => isNative();

function copyArrayBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(0);
  }
  if (ArrayBuffer.isView(buffer)) {
    const view = new Uint8Array(buffer.byteLength);
    view.set(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
    return view.buffer;
  }
  return buffer;
}

export function toAnimeStreamPath(url = "") {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://localhost");
    if (parsed.pathname.startsWith("/api/sources/")) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    /* keep original */
  }
  return url;
}

function resolveFetchUrl(requestUrl = "") {
  const sourcePath = toAnimeStreamPath(requestUrl);
  if (sourcePath.startsWith("http")) return sourcePath;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${sourcePath.startsWith("/") ? sourcePath : `/${sourcePath}`}`;
  }
  return sourcePath;
}

async function fetchViaBridge(sourcePath, responseType = "text") {
  const { handleSourceRequest } = await import("../../../server/clientSourceRequest.js");
  const result = await handleSourceRequest(sourcePath);
  if (!result || result.kind !== "stream") throw new Error(t("errors.loadStream"));
  const raw = result.buffer;
  const contentType = result.contentType || "";
  if (responseType === "arraybuffer") return { data: copyArrayBuffer(raw), contentType };
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  return { data: new TextDecoder().decode(bytes), contentType };
}

async function fetchViaHttp(requestUrl, responseType = "text") {
  const response = await fetch(resolveFetchUrl(requestUrl));
  if (!response.ok) throw new Error(t("errors.loadStreamStatus", { status: response.status }));
  const contentType = response.headers.get("content-type") || "";
  const data = responseType === "arraybuffer" ? await response.arrayBuffer() : await response.text();
  return { data, contentType };
}

export async function fetchAnimeStreamPayload(requestUrl, responseType = "text") {
  const sourcePath = toAnimeStreamPath(requestUrl);
  if (useSourceBridge()) return fetchViaBridge(sourcePath, responseType);
  return fetchViaHttp(requestUrl, responseType);
}

export function createSourceStreamLoader() {
  return class AnimeStreamLoader extends FetchLoader {
    constructor(config) {
      super(config);
    }

    load(context, config, callbacks) {
      const sourcePath = toAnimeStreamPath(context.url);
      if (!sourcePath.startsWith("/api/sources/")) {
        super.load(context, config, callbacks);
        return;
      }

      try {
        this.context = context;
        this.config = config;
        this.callbacks = callbacks;
        this.stats.loading.start = performance.now();
        this.stats.aborted = false;
        this.stats.loaded = 0;
        this.stats.retry = 0;

        fetchAnimeStreamPayload(context.url, context.responseType || "text")
          .then(({ data }) => {
            if (this.stats.aborted) return;
            const byteLength = typeof data === "string"
              ? new TextEncoder().encode(data).byteLength
              : data.byteLength;
            this.stats.loaded = byteLength;
            this.stats.total = byteLength;
            this.stats.loading.first = performance.now();
            this.stats.loading.end = performance.now();
            callbacks.onSuccess(
              { data, url: context.url, code: 200 },
              this.stats,
              context,
              null,
            );
          })
          .catch((error) => {
            if (this.stats.aborted) return;
            callbacks.onError(
              { code: 0, text: error?.message || t("errors.loadStream") },
              context,
              null,
              this.stats,
            );
          });
      } catch (error) {
        callbacks.onError(
          { code: 0, text: error?.message || t("errors.loadStream") },
          context,
          null,
          this.stats,
        );
      }
    }
  };
}
