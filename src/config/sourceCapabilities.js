/**
 * Capacités par source — point unique pour le routage API client et l'UI catalogue.
 * Ajouter une source : mettre à jour sourceProfiles, sourceRegistry et cette table.
 */
export const SOURCE_CAPABILITIES = Object.freeze({
  mangalik: { genreFilter: true, tagFilter: true },
  azorafly: { genreFilter: true, catalogScopedSearch: true },
  novelsparadise: { genreFilter: true, tagFilter: true, catalogScopedSearch: true },
  kolnovel: { genreFilter: true, tagFilter: true, catalogScopedSearch: true },
  dilar: { genreFilter: true, tagFilter: true, catalogScopedSearch: true, kindQueryParam: "genre" },
  wtrlab: { genreFilter: true, tagFilter: true, catalogScopedSearch: true, kindQueryParam: "kind" },
  novelphoenix: { genreFilter: true, tagFilter: true, catalogScopedSearch: true, kindQueryParam: "kind" },
  galaxynovels: { filterPath: true, catalogScopedSearch: true },
  realmnovel: { genreFilter: true, tagFilter: true },
  cenele: { filterPath: true, catalogScopedSearch: true },
  anime4up: { filterPath: true, catalogScopedSearch: true },
  animedar: { filterPath: true, catalogScopedSearch: true },
  frenchstream: { filterPath: true, multiTaxonomy: true },
  wiflix: { filterPath: true, multiTaxonomy: true },
});

export function sourceCapability(sourceId, key) {
  return Boolean(SOURCE_CAPABILITIES[sourceId]?.[key]);
}

export function sourcesWithCapability(key) {
  return Object.entries(SOURCE_CAPABILITIES)
    .filter(([, caps]) => caps[key])
    .map(([id]) => id);
}

export function getKindQueryParam(sourceId) {
  return SOURCE_CAPABILITIES[sourceId]?.kindQueryParam ?? null;
}
