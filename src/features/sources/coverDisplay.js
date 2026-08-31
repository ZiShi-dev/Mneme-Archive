export function usesContainCover(_sourceId) {
  return false;
}

/** Vignettes paysage (16:9) — sources vidéo type HentaiGasm. */
const WIDE_COVER_SOURCE_IDS = new Set([
  "hentaigasm",
]);

export function usesWideCover(sourceId) {
  return WIDE_COVER_SOURCE_IDS.has(String(sourceId || ""));
}

export function isStandaloneVideoCatalogItem(item) {
  return item?.catalogStyle === "standalone";
}
