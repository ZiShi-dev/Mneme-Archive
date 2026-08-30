const GLOBAL_KEY = "__manhawSourceNativeFetch";

function state() {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = { fetchHtml: null, fetchImage: null };
  }
  return globalThis[GLOBAL_KEY];
}

export function configureSourceNativeFetch({ fetchHtml, fetchImage } = {}) {
  const next = state();
  if (fetchHtml !== undefined) next.fetchHtml = fetchHtml;
  if (fetchImage !== undefined) next.fetchImage = fetchImage;
}

export function clearSourceNativeFetch() {
  configureSourceNativeFetch({ fetchHtml: null, fetchImage: null });
}

export function hasNativeHtmlFetcher() {
  return typeof state().fetchHtml === "function";
}

export async function fetchNativeHtml(url, fallback) {
  const { fetchHtml } = state();
  if (fetchHtml) return fetchHtml(url);
  return fallback();
}

export async function fetchNativeImage(url, fallback) {
  const { fetchImage } = state();
  if (fetchImage) return fetchImage(url);
  return fallback();
}
