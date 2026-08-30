/** Sources dont le HTML passe par la WebView Android (contournement Cloudflare). */
export const WEBVIEW_SOURCE_IDS = Object.freeze([
  "mangalik",
  "azorafly",
  "galaxynovels",
  "arabshentai",
  "hentairead",
  "mangaforfree",
  "novelsparadise",
  "kolnovel",
  "novelphoenix",
]);

export const WEBVIEW_SOURCE_ID_SET = new Set(WEBVIEW_SOURCE_IDS);

export function usesWebViewSource(sourceId) {
  return WEBVIEW_SOURCE_ID_SET.has(sourceId);
}

/** Charge les filtres après le catalogue pour éviter deux passages WebView simultanés. */
export function shouldDeferCatalogFilters(sourceId) {
  return WEBVIEW_SOURCE_ID_SET.has(sourceId);
}
