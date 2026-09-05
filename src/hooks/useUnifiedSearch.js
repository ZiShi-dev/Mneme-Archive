import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { filterItemsByAudioLanguage } from "../features/sources/audioLanguage";
import {
  buildSearchScopeKey,
  filterSearchResults,
  flattenSearchBatches,
  getEnabledSources,
  isUnifiedSearchQueryActive,
  normalizeUnifiedSearchQuery,
  peekCachedSearchBatches,
  resolveUnifiedSearchDebounceMs,
  searchEnabledSources,
} from "../lib/unifiedSearch";
import { t } from "../i18n/runtime.js";

function mapSearchErrors(batches = []) {
  return batches
    .filter((batch) => batch.error)
    .map((batch) => ({
      sourceId: batch.sourceId,
      sourceName: batch.sourceName,
      message: batch.error,
    }));
}

function applySearchBatches(batches, query, audioFilter) {
  const flattened = filterItemsByAudioLanguage(
    flattenSearchBatches(batches, query),
    audioFilter,
  );
  return {
    results: flattened,
    searchErrors: mapSearchErrors(batches),
  };
}

export function useUnifiedSearch({
  sources,
  sourcePreferences,
  query,
  mediaType = "all",
  audioFilter = "all",
} = {}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchErrors, setSearchErrors] = useState([]);
  const [fatalError, setFatalError] = useState("");
  const requestIdRef = useRef(0);
  const abortRef = useRef(null);
  const prevQueryRef = useRef("");
  const resultsRef = useRef([]);
  const pendingBatchesRef = useRef(null);
  const rafRef = useRef(0);
  const sourcesRef = useRef(sources);
  const preferencesRef = useRef(sourcePreferences);
  const audioFilterRef = useRef(audioFilter);
  const batchesRef = useRef([]);

  sourcesRef.current = sources;
  preferencesRef.current = sourcePreferences;
  audioFilterRef.current = audioFilter;

  const normalizedQuery = normalizeUnifiedSearchQuery(query);
  const enabledSources = useMemo(() => getEnabledSources(sources), [sources]);
  const searchScopeKey = useMemo(
    () => buildSearchScopeKey(sources, sourcePreferences, mediaType),
    [mediaType, sourcePreferences, sources],
  );
  const searchActive = isUnifiedSearchQueryActive(normalizedQuery) && Boolean(searchScopeKey);
  const hasPartialErrors = searchErrors.length > 0 && results.length > 0;

  const applyBatches = useCallback((batches, activeQuery = normalizedQuery) => {
    batchesRef.current = batches;
    const next = applySearchBatches(batches, activeQuery, audioFilterRef.current);
    startTransition(() => {
      setResults(next.results);
      setSearchErrors(next.searchErrors);
    });
    resultsRef.current = next.results;
    if (next.results.length) setLoading(false);
    return next;
  }, [normalizedQuery]);

  const flushPendingBatches = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const pending = pendingBatchesRef.current;
    pendingBatchesRef.current = null;
    if (!pending) return;
    applyBatches(pending.batches, pending.activeQuery);
  }, [applyBatches]);

  const scheduleApply = useCallback((batches, activeQuery = normalizedQuery) => {
    pendingBatchesRef.current = { batches, activeQuery };
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      flushPendingBatches();
    });
  }, [flushPendingBatches, normalizedQuery]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    pendingBatchesRef.current = null;

    if (!isUnifiedSearchQueryActive(normalizedQuery) || !searchScopeKey) {
      setResults([]);
      setSearchErrors([]);
      setFatalError("");
      setLoading(false);
      setIsRefreshing(false);
      prevQueryRef.current = "";
      resultsRef.current = [];
      batchesRef.current = [];
      return undefined;
    }

    const latestSources = sourcesRef.current;
    const latestPreferences = preferencesRef.current;
    const previousQuery = prevQueryRef.current;
    const isQueryExtension = previousQuery
      && normalizedQuery.startsWith(previousQuery)
      && normalizedQuery.length > previousQuery.length;

    if (isQueryExtension && resultsRef.current.length) {
      const filtered = filterSearchResults(resultsRef.current, normalizedQuery);
      if (filtered.length) {
        setResults(filtered);
        resultsRef.current = filtered;
        setLoading(false);
      }
    } else if (!isQueryExtension && previousQuery && !normalizedQuery.startsWith(previousQuery)) {
      setResults([]);
      resultsRef.current = [];
    }

    const cachedBatches = peekCachedSearchBatches({
      sources: latestSources,
      sourcePreferences: latestPreferences,
      query: normalizedQuery,
      mediaType,
    });
    const cacheReady = cachedBatches.length > 0;

    if (cacheReady) {
      applyBatches(cachedBatches);
      setLoading(false);
    } else if (!isQueryExtension || !resultsRef.current.length) {
      setLoading(true);
    }

    const requestId = requestIdRef.current;
    const debounceMs = resolveUnifiedSearchDebounceMs(normalizedQuery, { cacheReady });
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setFatalError("");
      setIsRefreshing(true);
      if (!cacheReady && !resultsRef.current.length) setLoading(true);

      const mergeAndApply = (batches) => {
        if (requestId !== requestIdRef.current) return;
        if (controller.signal.aborted) return;
        scheduleApply(batches, normalizedQuery);
      };

      searchEnabledSources({
        sources: latestSources,
        sourcePreferences: latestPreferences,
        query: normalizedQuery,
        mediaType,
        signal: controller.signal,
        onBatch: mergeAndApply,
      })
        .then((batches) => {
          mergeAndApply(batches);
          flushPendingBatches();
          if (requestId === requestIdRef.current) {
            prevQueryRef.current = normalizedQuery;
          }
        })
        .catch((reason) => {
          if (reason?.name === "AbortError") return;
          if (requestId !== requestIdRef.current) return;
          setResults([]);
          setSearchErrors([]);
          resultsRef.current = [];
          setFatalError(reason instanceof Error ? reason.message : t("errors.searchFailed"));
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setLoading(false);
            setIsRefreshing(false);
          }
        });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [
    applyBatches,
    mediaType,
    normalizedQuery,
    scheduleApply,
    flushPendingBatches,
    searchScopeKey,
  ]);

  useEffect(() => {
    if (!batchesRef.current.length) return undefined;
    applyBatches(batchesRef.current);
    return undefined;
  }, [audioFilter, applyBatches]);

  const showTotalFailure = searchActive && !loading && !isRefreshing && !results.length && searchErrors.length > 0 && !fatalError;

  return {
    results,
    loading,
    isRefreshing,
    searchErrors,
    fatalError,
    enabledSources,
    normalizedQuery,
    searchActive,
    hasPartialErrors,
    showTotalFailure,
  };
}
