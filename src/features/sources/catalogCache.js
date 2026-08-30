import { catalogViewKey, sanitizeCatalogKind } from "./catalogView";
import { kvGetSync, kvSet } from "../../lib/storage/initStorage";

export const CATALOG_STATE_KEY = "living-archive:catalog-state";
export const EMPTY_CATALOG_STATE = { pages: {}, filters: {}, kinds: {}, queries: {}, hasMore: {}, audioFilters: {} };
export const CATALOG_SNAPSHOT_MAX_AGE_MS = 2 * 60 * 1000;

const catalogSnapshotCache = new Map();
export const catalogFiltersCache = new Map();
export const catalogLiveViewCache = new Map();

export function readCatalogState() {
  return kvGetSync(CATALOG_STATE_KEY, EMPTY_CATALOG_STATE);
}

export function writeCatalogStateSync(nextState) {
  void kvSet(CATALOG_STATE_KEY, nextState);
}

function catalogSnapshotKey(sourceId, filter, page, query = "", kind = null) {
  return `${catalogViewKey(sourceId, filter, query, kind)}:p${page}`;
}

export function readCatalogSnapshot(sourceId, filter, page, query = "", kind = null) {
  return catalogSnapshotCache.get(catalogSnapshotKey(sourceId, filter, page, query, kind));
}

export function writeCatalogSnapshot(sourceId, filter, page, items, hasMore, query = "", kind = null) {
  if (!Array.isArray(items) || !items.length) return;
  catalogSnapshotCache.set(catalogSnapshotKey(sourceId, filter, page, query, kind), {
    items,
    hasMore: Boolean(hasMore),
    at: Date.now(),
  });
}

export function invalidateCatalogSnapshots(sourceId) {
  const prefix = `${sourceId}:`;
  for (const key of catalogSnapshotCache.keys()) {
    if (key.startsWith(prefix)) catalogSnapshotCache.delete(key);
  }
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
