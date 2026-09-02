import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { filterItemsByAudioLanguage } from "../features/sources/audioLanguage";
import {
  filterSearchResults,
  flattenSearchBatches,
  getEnabledSources,
  isUnifiedSearchQueryActive,
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

  const normalizedQuery = query.trim();
  const enabledSources = useMemo(() => getEnabledSources(sources), [sources]);
  const searchActive = isUnifiedSearchQueryActive(normalizedQuery) && enabledSources.length > 0;
  const hasPartialErrors = searchErrors.length > 0 && results.length > 0;

  const applyBatches = useCallback((batches, activeQuery = normalizedQuery) => {
    const next = applySearchBatches(batches, activeQuery, audioFilter);
    setResults(next.results);
    setSearchErrors(next.searchErrors);
    resultsRef.current = next.results;
    if (next.results.length) setLoading(false);
    return next;
  }, [audioFilter, normalizedQuery]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort();

    if (!isUnifiedSearchQueryActive(normalizedQuery)) {
      setResults([]);
      setSearchErrors([]);
      setFatalError("");
      setLoading(false);
      setIsRefreshing(false);
      prevQueryRef.current = "";
      resultsRef.current = [];
      return undefined;
    }

    if (!enabledSources.length) {
      setResults([]);
      setSearchErrors([]);
      setFatalError("");
      setLoading(false);
      setIsRefreshing(false);
      prevQueryRef.current = "";
      resultsRef.current = [];
      return undefined;
    }

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
      sources,
      sourcePreferences,
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
        applyBatches(batches);
      };

      searchEnabledSources({
        sources,
        sourcePreferences,
        query: normalizedQuery,
        mediaType,
        signal: controller.signal,
        onBatch: mergeAndApply,
      })
        .then((batches) => {
          mergeAndApply(batches);
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
    };
  }, [
    applyBatches,
    audioFilter,
    enabledSources.length,
    mediaType,
    normalizedQuery,
    sourcePreferences,
    sources,
  ]);

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
