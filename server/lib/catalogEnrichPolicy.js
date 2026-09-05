/** Contrôle du enrich catalogue (?enrich=0 pour réponse rapide sans N×fetch série). */
export function parseCatalogEnrichFlag(raw) {
  if (raw == null || raw === "") return true;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return true;
}

/** Catalogue : enrich par défaut sauf ?enrich=0 */
export function catalogEnrichFromCatalogParams(searchParams) {
  return parseCatalogEnrichFlag(searchParams?.get?.("enrich"));
}

/** Recherche : pas d'enrich par défaut (réponse rapide) ; ?enrich=1 pour forcer */
export function catalogEnrichFromSearchParams(searchParams) {
  const raw = searchParams?.get?.("enrich");
  if (raw == null || raw === "") return false;
  return parseCatalogEnrichFlag(raw);
}
