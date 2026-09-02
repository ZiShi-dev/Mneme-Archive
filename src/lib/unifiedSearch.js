import { getSourceProfile, initialSourcePreferences } from "../config/sources.js";
import { t } from "../i18n/runtime.js";
import { getItemType } from "../features/sources/contentTypes.js";
import {
  pickTypoFallbackQueries,
  rankSearchResults,
  resolveSearchMinScore,
  scoreSearchItem,
} from "../../server/lib/searchScoring.js";

let defaultSearchSourceImpl;

async function resolveSearchSourceImpl(searchSourceImpl) {
  if (searchSourceImpl) return searchSourceImpl;
  if (!defaultSearchSourceImpl) {
    ({ searchSource: defaultSearchSourceImpl } = await import("../features/sources/sourceApi.js"));
  }
  return defaultSearchSourceImpl;
}

const SEARCH_CACHE_TTL_MS = 90_000;
const SEARCH_CACHE_MAX = 80;
const MAX_VARIANTS_PER_SOURCE = 2;
const MAX_SOURCES_FOR_VARIANTS = 2;
const MIN_PRIMARY_RESULTS = 1;
const PER_SOURCE_LIMIT = 12;
export const UNIFIED_RESULT_LIMIT = 36;
export const MIN_UNIFIED_SEARCH_QUERY_LENGTH = 2;
export const UNIFIED_SEARCH_DEBOUNCE_MS = 150;
export const UNIFIED_SEARCH_DEBOUNCE_SHORT_MS = 200;

export function sourceSupportsMediaType(sourceId, mediaType = "all") {
  if (!mediaType || mediaType === "all") return true;
  const types = getSourceProfile(sourceId).contentTypes || [];
  return types.includes(mediaType);
}

export function searchItemMatchesMediaType(item, mediaType = "all") {
  if (!mediaType || mediaType === "all") return true;
  return getItemType(item) === mediaType;
}

const searchCache = new Map();

function cacheKey(sourceId, query) {
  return `${sourceId}:${query.trim().toLowerCase()}`;
}

function readSearchCache(sourceId, query) {
  const entry = searchCache.get(cacheKey(sourceId, query));
  if (!entry) return null;
  if (Date.now() - entry.at > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(cacheKey(sourceId, query));
    return null;
  }
  return entry.data;
}

function writeSearchCache(sourceId, query, data) {
  if (searchCache.size >= SEARCH_CACHE_MAX) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) searchCache.delete(oldestKey);
  }
  searchCache.set(cacheKey(sourceId, query), { at: Date.now(), data });
}

export function resetUnifiedSearchCache() {
  searchCache.clear();
}

function assertNotAborted(signal) {
  if (signal?.aborted) {
    const error = new Error("Aborted");
    error.name = "AbortError";
    throw error;
  }
}

async function fetchSourceSearch(sourceId, query, { signal, searchSourceImpl } = {}) {
  assertNotAborted(signal);
  const cached = readSearchCache(sourceId, query);
  if (cached) return cached;
  const search = await resolveSearchSourceImpl(searchSourceImpl);
  const data = await search(sourceId, query, { signal });
  writeSearchCache(sourceId, query, data);
  return data;
}

function matchesQuery(item, query) {
  return scoreSearchItem(item, query) >= resolveSearchMinScore(query);
}

function rankSourceItems(items, query, mediaType) {
  const filtered = mediaType && mediaType !== "all"
    ? items.filter((item) => searchItemMatchesMediaType(item, mediaType))
    : items;
  return rankSearchResults(filtered, query, { limit: PER_SOURCE_LIMIT });
}

async function searchSourcePrimary(sourceId, query, mediaType, options = {}) {
  const data = await fetchSourceSearch(sourceId, query, options);
  return rankSourceItems(data.items || [], query, mediaType);
}

async function searchSourceWithVariants(sourceId, query, mediaType, options = {}) {
  const variants = pickTypoFallbackQueries(query, MAX_VARIANTS_PER_SOURCE);
  for (const variant of variants) {
    assertNotAborted(options.signal);
    const data = await fetchSourceSearch(sourceId, variant, options);
    const ranked = rankSourceItems(data.items || [], query, mediaType);
    if (ranked.length) return ranked;
  }
  return [];
}

export function getEnabledSources(sources = []) {
  return sources.filter((source) => source.enabled !== false);
}

export function isUnifiedSearchQueryActive(query = "") {
  return query.trim().length >= MIN_UNIFIED_SEARCH_QUERY_LENGTH;
}

export function resolveUnifiedSearchDebounceMs(query = "", { cacheReady = false } = {}) {
  if (cacheReady) return 0;
  const length = query.trim().length;
  if (length >= 5) return 120;
  if (length >= 3) return UNIFIED_SEARCH_DEBOUNCE_MS;
  return UNIFIED_SEARCH_DEBOUNCE_SHORT_MS;
}

export function filterSearchResults(items = [], query = "") {
  const trimmed = query.trim();
  if (!trimmed) return items;
  const minScore = resolveSearchMinScore(trimmed);
  return items.filter((item) => scoreSearchItem(item, trimmed) >= minScore);
}

function decorateBatchItems(items, source, profile) {
  return items.map((item) => ({
    ...item,
    sourceId: item.sourceId || source.id,
    sourceName: profile.name,
  }));
}

async function buildSelectedSourceBatch(source, trimmed, mediaType, sourcePreferences) {
  const preference = { ...initialSourcePreferences[source.id], ...sourcePreferences[source.id] };
  const profile = getSourceProfile(source.id);
  const items = decorateBatchItems(
    (preference.selectedItems || [])
      .filter((item) => matchesQuery(item, trimmed) && searchItemMatchesMediaType(item, mediaType)),
    source,
    profile,
  );
  return { sourceId: source.id, sourceName: profile.name, items, error: null };
}

async function buildRemoteSourceBatch(source, trimmed, mediaType, searchOptions) {
  const profile = getSourceProfile(source.id);
  try {
    const items = decorateBatchItems(
      await searchSourcePrimary(source.id, trimmed, mediaType, searchOptions),
      source,
      profile,
    );
    return { sourceId: source.id, sourceName: profile.name, items, error: null };
  } catch (reason) {
    if (reason?.name === "AbortError") throw reason;
    return {
      sourceId: source.id,
      sourceName: profile.name,
      items: [],
      error: reason instanceof Error ? reason.message : t("sources.searchFailed"),
    };
  }
}

async function buildSourceSearchBatch(source, trimmed, mediaType, sourcePreferences, searchOptions) {
  assertNotAborted(searchOptions.signal);
  const preference = { ...initialSourcePreferences[source.id], ...sourcePreferences[source.id] };
  if (preference.mode === "selected") {
    return buildSelectedSourceBatch(source, trimmed, mediaType, sourcePreferences);
  }
  return buildRemoteSourceBatch(source, trimmed, mediaType, searchOptions);
}

function emitSearchBatches(batches, onBatch) {
  if (!onBatch) return;
  onBatch(batches.filter(Boolean));
}

export function peekCachedSearchBatches({
  sources,
  sourcePreferences = {},
  query,
  mediaType = "all",
} = {}) {
  const trimmed = query.trim();
  if (!isUnifiedSearchQueryActive(trimmed)) return [];

  const enabledSources = getEnabledSources(sources).filter((source) => sourceSupportsMediaType(source.id, mediaType));
  return enabledSources.map((source) => {
    const preference = { ...initialSourcePreferences[source.id], ...sourcePreferences[source.id] };
    const profile = getSourceProfile(source.id);

    if (preference.mode === "selected") {
      const items = decorateBatchItems(
        (preference.selectedItems || [])
          .filter((item) => matchesQuery(item, trimmed) && searchItemMatchesMediaType(item, mediaType)),
        source,
        profile,
      );
      return { sourceId: source.id, sourceName: profile.name, items, error: null };
    }

    const cached = readSearchCache(source.id, trimmed);
    if (!cached) return null;

    const items = decorateBatchItems(
      rankSourceItems(cached.items || [], trimmed, mediaType),
      source,
      profile,
    );
    return { sourceId: source.id, sourceName: profile.name, items, error: null };
  }).filter(Boolean);
}

async function applyVariantFallback(batches, trimmed, mediaType, searchOptions, onBatch) {
  const variantTargets = batches
    .filter((batch) => !batch.error && !batch.items.length)
    .slice(0, MAX_SOURCES_FOR_VARIANTS);

  if (!variantTargets.length) return batches;

  await Promise.all(variantTargets.map(async (batch) => {
    assertNotAborted(searchOptions.signal);
    try {
      const items = (await searchSourceWithVariants(batch.sourceId, trimmed, mediaType, searchOptions)).map((item) => ({
        ...item,
        sourceId: item.sourceId || batch.sourceId,
        sourceName: batch.sourceName,
      }));
      batch.items = items;
      emitSearchBatches(batches, onBatch);
    } catch (reason) {
      if (reason?.name === "AbortError") throw reason;
      batch.items = batch.items || [];
    }
  }));

  return batches;
}

export async function searchEnabledSources({
  sources,
  sourcePreferences = {},
  query,
  mediaType = "all",
  signal,
  searchSourceImpl,
  onBatch,
  deferVariants = Boolean(onBatch),
} = {}) {
  const trimmed = query.trim();
  const normalized = trimmed.toLowerCase();
  if (normalized.length < MIN_UNIFIED_SEARCH_QUERY_LENGTH) return [];

  const searchOptions = { signal, searchSourceImpl };
  const enabledSources = getEnabledSources(sources).filter((source) => sourceSupportsMediaType(source.id, mediaType));
  if (!enabledSources.length) return [];

  const batches = new Array(enabledSources.length);

  await Promise.all(enabledSources.map(async (source, index) => {
    const batch = await buildSourceSearchBatch(source, trimmed, mediaType, sourcePreferences, searchOptions);
    batches[index] = batch;
    emitSearchBatches(batches, onBatch);
  }));

  const resolvedBatches = batches.filter(Boolean);
  const primaryCount = resolvedBatches.reduce((total, batch) => total + batch.items.length, 0);
  if (primaryCount >= MIN_PRIMARY_RESULTS) {
    return resolvedBatches;
  }

  const runVariants = () => applyVariantFallback(resolvedBatches, trimmed, mediaType, searchOptions, onBatch);

  if (deferVariants) {
    void runVariants().catch((reason) => {
      if (reason?.name === "AbortError") return;
    });
    return resolvedBatches;
  }

  return runVariants();
}

export function flattenSearchBatches(batches, query = "") {
  const items = batches.flatMap((batch) => batch.items.map((item) => ({
    ...item,
    key: `${batch.sourceId}:${item.url}`,
    sourceId: batch.sourceId,
    sourceName: batch.sourceName,
  })));

  if (!String(query).trim()) return items;

  return rankSearchResults(items, query, { limit: UNIFIED_RESULT_LIMIT }).map((item) => ({
    ...item,
    key: item.key || `${item.sourceId}:${item.url}`,
  }));
}
