/** Contrôle du enrich catalogue (?enrich=0 pour réponse rapide sans N×fetch série). */
export function parseCatalogEnrichFlag(raw) {
  if (raw == null || raw === "") return true;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return true;
}

export function catalogEnrichFromSearchParams(searchParams) {
  return parseCatalogEnrichFlag(searchParams?.get?.("enrich"));
}
