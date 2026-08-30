/** Sources Cloudflare : HTML via FlareSolverr, sans WebView ni fetch HTTP d’abord. */
export const FLARE_DIRECT_SOURCE_IDS = Object.freeze([
  "mangalik",
  "arabshentai",
  "hentairead",
  "hentaigasm",
  "mangadistrict",
  "manhwaread",
  "novelsparadise",
  "kolnovel",
]);

export const FLARE_DIRECT_SOURCE_ID_SET = new Set(FLARE_DIRECT_SOURCE_IDS);

/** Sources Cloudflare : HTTP natif + Custom Tabs Android si vérification requise. */
export const WEBVIEW_SOURCE_IDS = Object.freeze([
  "azorafly",
  "galaxynovels",
  "mangaforfree",
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
