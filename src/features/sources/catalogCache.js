import { catalogViewKey, sanitizeCatalogKind } from "./catalogView.js";
import { kvGetSync, kvSet } from "../../lib/storage/initStorage.js";
import { compactSnapshotItems } from "./catalogSnapshotModel.js";

export const CATALOG_STATE_KEY = "living-archive:catalog-state";
export const CATALOG_SNAPSHOTS_KEY = "living-archive:catalog-snapshots";
export const EMPTY_CATALOG_STATE = { pages: {}, filters: {}, kinds: {}, queries: {}, hasMore: {}, audioFilters: {}, sourceFilters: {} };
export const CATALOG_SNAPSHOT_MAX_AGE_MS = 2 * 60 * 1000;
const MAX_SNAPSHOTS_PER_SOURCE = 3;

const catalogSnapshotCache = new Map();
let snapshotsHydrated = false;
export const catalogFiltersCache = new Map();
export const catalogLiveViewCache = new Map();

export function readCatalogState() {
  return kvGetSync(CATALOG_STATE_KEY, EMPTY_CATALOG_STATE);
}

export function writeCatalogStateSync(nextState) {
  void kvSet(CATALOG_STATE_KEY, nextState);
}

/** Persiste la requête catalogue sans attendre un refresh réseau. */
export function persistCatalogQuery(sourceId, catalogQuery = "") {
  const normalizedQuery = catalogQuery || "";
  const stored = readCatalogState();
  const prevLive = catalogLiveViewCache.get(sourceId) || {};
  catalogLiveViewCache.set(sourceId, {
    ...prevLive,
    query: normalizedQuery,
    ...(normalizedQuery ? {} : { page: 1 }),
  });
  const nextState = {
    ...stored,
    queries: { ...(stored.queries || {}), [sourceId]: normalizedQuery },
  };
  writeCatalogStateSync(nextState);
  return nextState;
}

function catalogSnapshotKey(sourceId, filter, page, query = "", kind = null) {
  return `${catalogViewKey(sourceId, filter, query, kind)}:p${page}`;
}

function pruneSnapshotsForSource(sourceId) {
  const prefix = `${sourceId}:`;
  const owned = [...catalogSnapshotCache.entries()]
    .filter(([key]) => key.startsWith(prefix))
    .sort((left, right) => (right[1]?.at || 0) - (left[1]?.at || 0));
  for (const [key] of owned.slice(MAX_SNAPSHOTS_PER_SOURCE)) {
    catalogSnapshotCache.delete(key);
  }
}

function persistCatalogSnapshots() {
  const payload = {};
  for (const [key, entry] of catalogSnapshotCache.entries()) {
    if (!entry?.items?.length) continue;
    payload[key] = {
      items: entry.items,
      hasMore: Boolean(entry.hasMore),
      at: entry.at || Date.now(),
    };
  }
  void kvSet(CATALOG_SNAPSHOTS_KEY, payload);
}

export function hydrateCatalogSnapshots() {
  if (snapshotsHydrated) return;
  snapshotsHydrated = true;
  const stored = kvGetSync(CATALOG_SNAPSHOTS_KEY, null);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return;
  for (const [key, entry] of Object.entries(stored)) {
    if (!Array.isArray(entry?.items) || !entry.items.length) continue;
    if (catalogSnapshotCache.has(key)) continue;
    catalogSnapshotCache.set(key, {
      items: entry.items,
      hasMore: Boolean(entry.hasMore),
      at: Number(entry.at) || 0,
    });
  }
}

export function resetCatalogSnapshotCache() {
  catalogSnapshotCache.clear();
  snapshotsHydrated = false;
}

export function readCatalogSnapshot(sourceId, filter, page, query = "", kind = null) {
  hydrateCatalogSnapshots();
  return catalogSnapshotCache.get(catalogSnapshotKey(sourceId, filter, page, query, kind));
}

export function writeCatalogSnapshot(sourceId, filter, page, items, hasMore, query = "", kind = null) {
  if (!Array.isArray(items) || !items.length) return;
  const compactItems = compactSnapshotItems(items);
  if (!compactItems.length) return;
  catalogSnapshotCache.set(catalogSnapshotKey(sourceId, filter, page, query, kind), {
    items: compactItems,
    hasMore: Boolean(hasMore),
    at: Date.now(),
  });
  pruneSnapshotsForSource(sourceId);
  persistCatalogSnapshots();
}

export function invalidateCatalogSnapshots(sourceId) {
  const prefix = `${sourceId}:`;
  for (const key of catalogSnapshotCache.keys()) {
    if (key.startsWith(prefix)) catalogSnapshotCache.delete(key);
  }
  persistCatalogSnapshots();
}

export function readPersistedSourceFilters(sourceId) {
  const stored = readCatalogState();
  return stored.sourceFilters?.[sourceId] ?? null;
}

export function persistSourceFilters(sourceId, nextFilters) {
  if (!sourceId || !nextFilters) return readCatalogState();
  catalogFiltersCache.set(sourceId, nextFilters);
  const stored = readCatalogState();
  const nextState = {
    ...stored,
    sourceFilters: { ...(stored.sourceFilters || {}), [sourceId]: nextFilters },
  };
  writeCatalogStateSync(nextState);
  return nextState;
}

export function hydrateSourceFilters(sourceId, peekFilters) {
  const memory = catalogFiltersCache.get(sourceId);
  if (memory?.categories?.length || memory?.tags?.length || memory?.kinds?.length) return memory;

  const persisted = readPersistedSourceFilters(sourceId);
  if (persisted?.categories?.length || persisted?.tags?.length || persisted?.kinds?.length) {
    catalogFiltersCache.set(sourceId, persisted);
    return persisted;
  }

  if (peekFilters?.categories?.length || peekFilters?.tags?.length || peekFilters?.kinds?.length) {
    catalogFiltersCache.set(sourceId, peekFilters);
    return peekFilters;
  }

  return memory || persisted || peekFilters || null;
}

export function resolveCatalogBoot(sourceId, enabled, mode) {
  if (!enabled) {
    return { status: "disabled", items: [], page: 1, hasMore: false, filter: null, kind: null, audioFilter: "all", query: "" };
  }
  if (mode === "selected") {
    return { status: "ready", items: [], page: 1, hasMore: false, filter: null, kind: null, audioFilter: "all", query: "" };
  }

  const live = catalogLiveViewCache.get(sourceId);
  const stored = readCatalogState();
  let filter = live?.filter ?? stored.filters?.[sourceId] ?? null;
  if (sourceId === "galaxynovels" && (filter?.type === "author" || filter?.author)) {
    filter = null;
  }
  const kind = sanitizeCatalogKind(sourceId, live?.kind ?? stored.kinds?.[sourceId] ?? null);
  const audioFilter = live?.audioFilter ?? stored.audioFilters?.[sourceId] ?? "all";
  const query = live?.query ?? stored.queries?.[sourceId] ?? "";
  const viewKey = catalogViewKey(sourceId, filter, query, kind);
  const page = live?.page ?? stored.pages?.[viewKey] ?? 1;
  const snapshot = readCatalogSnapshot(sourceId, filter, page, query, kind);
  const items = live?.items?.length ? live.items : snapshot?.items || [];
  const hasMore = live?.hasMore ?? snapshot?.hasMore ?? Boolean(stored.hasMore?.[viewKey]);

  if (items.length) {
    return {
      status: "ready",
      items,
      page,
      hasMore,
      filter,
      kind,
      audioFilter,
      query,
    };
  }

  return { status: "loading", items: [], page, hasMore, filter, kind, audioFilter, query };
}
