/** Sources avec challenge Cloudflare : HTML via FlareSolverr d’abord. */
export const FLARE_DIRECT_SOURCE_IDS = Object.freeze([
  "mangalik",
  "novelsparadise",
]);

export const FLARE_DIRECT_SOURCE_ID_SET = new Set(FLARE_DIRECT_SOURCE_IDS);

/** Sources Cloudflare : WebView Android d’abord, Flare VPS en secours uniquement. */
export const WEBVIEW_SOURCE_IDS = Object.freeze([
  "azorafly",
  "galaxynovels",
  "novelphoenix",
]);

export const WEBVIEW_SOURCE_ID_SET = new Set(WEBVIEW_SOURCE_IDS);

export function usesWebViewSource(sourceId) {
  return WEBVIEW_SOURCE_ID_SET.has(sourceId);
}

export function usesFlareDirectSource(sourceId) {
  return FLARE_DIRECT_SOURCE_ID_SET.has(sourceId);
}

/** Charge les filtres après le catalogue pour éviter deux passages lents simultanés. */
export function shouldDeferCatalogFilters(sourceId) {
  return WEBVIEW_SOURCE_ID_SET.has(sourceId) || FLARE_DIRECT_SOURCE_ID_SET.has(sourceId);
}
