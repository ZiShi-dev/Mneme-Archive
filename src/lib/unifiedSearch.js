import { getSourceProfile, initialSourcePreferences } from "../config/sources";
import { t } from "../i18n/runtime.js";
import { getItemType } from "../features/sources/contentTypes";
import { searchSource } from "../features/sources/sourceApi";
import {
  pickTypoFallbackQueries,
  rankSearchResults,
  resolveSearchMinScore,
  scoreSearchItem,
} from "../../server/lib/searchScoring.js";

const SEARCH_CACHE_TTL_MS = 90_000;
const SEARCH_CACHE_MAX = 80;
const MAX_VARIANTS_PER_SOURCE = 2;
const MAX_SOURCES_FOR_VARIANTS = 4;
const MIN_PRIMARY_RESULTS = 1;
const PER_SOURCE_LIMIT = 12;
const UNIFIED_RESULT_LIMIT = 36;

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

async function fetchSourceSearch(sourceId, query) {
  const cached = readSearchCache(sourceId, query);
  if (cached) return cached;
  const data = await searchSource(sourceId, query);
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

async function searchSourcePrimary(sourceId, query, mediaType) {
  const data = await fetchSourceSearch(sourceId, query);
  return rankSourceItems(data.items || [], query, mediaType);
}

async function searchSourceWithVariants(sourceId, query, mediaType) {
  const variants = pickTypoFallbackQueries(query, MAX_VARIANTS_PER_SOURCE);
  for (const variant of variants) {
    const data = await fetchSourceSearch(sourceId, variant);
    const ranked = rankSourceItems(data.items || [], query, mediaType);
    if (ranked.length) return ranked;
  }
  return [];
}

export function getEnabledSources(sources = []) {
  return sources.filter((source) => source.enabled !== false);
}

export async function searchEnabledSources({ sources, sourcePreferences, query, mediaType = "all" }) {
  const trimmed = query.trim();
  const normalized = trimmed.toLowerCase();
  if (normalized.length < 2) return [];

  const enabledSources = getEnabledSources(sources).filter((source) => sourceSupportsMediaType(source.id, mediaType));
  const batches = await Promise.all(enabledSources.map(async (source) => {
    const preference = { ...initialSourcePreferences[source.id], ...sourcePreferences[source.id] };
    const profile = getSourceProfile(source.id);

    if (preference.mode === "selected") {
      const items = (preference.selectedItems || [])
        .filter((item) => matchesQuery(item, trimmed) && searchItemMatchesMediaType(item, mediaType))
        .map((item) => ({
          ...item,
          sourceId: item.sourceId || source.id,
          sourceName: profile.name,
        }));
      return { sourceId: source.id, sourceName: profile.name, items, error: null };
    }

    try {
      const items = (await searchSourcePrimary(source.id, trimmed, mediaType)).map((item) => ({
        ...item,
        sourceId: item.sourceId || source.id,
        sourceName: profile.name,
      }));
      return { sourceId: source.id, sourceName: profile.name, items, error: null };
    } catch (reason) {
      return {
        sourceId: source.id,
        sourceName: profile.name,
        items: [],
        error: reason instanceof Error ? reason.message : t("sources.searchFailed"),
      };
    }
  }));

  const primaryCount = batches.reduce((total, batch) => total + batch.items.length, 0);
  if (primaryCount >= MIN_PRIMARY_RESULTS) {
    return batches;
  }

  const variantTargets = batches
    .filter((batch) => !batch.error && !batch.items.length)
    .slice(0, MAX_SOURCES_FOR_VARIANTS);

  if (!variantTargets.length) {
    return batches;
  }

  await Promise.all(variantTargets.map(async (batch) => {
    try {
      const items = (await searchSourceWithVariants(batch.sourceId, trimmed, mediaType)).map((item) => ({
        ...item,
        sourceId: item.sourceId || batch.sourceId,
        sourceName: batch.sourceName,
      }));
      batch.items = items;
    } catch {
      batch.items = batch.items || [];
    }
  }));

  return batches;
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
