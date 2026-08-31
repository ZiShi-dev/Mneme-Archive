import React, { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { RefreshCw, Search, Wifi, X } from "lucide-react";
import { useToast } from "../../components/ui/ToastProvider";
import { defaultContentKinds, enrichKindWithFilterPath, getSourceProfile, initialSourcePreferences, initialSources, isKnownSourceId } from "../../config/sources";
import { useI18n } from "../../i18n/I18nProvider";
import { usePersistedState } from "../../hooks/usePersistedState";
import { kvSet } from "../../lib/storage/initStorage";
import { contentTypes } from "./contentTypes";
import { Header } from "../../components/layout/Header";
import { clearSourceApiCache, fetchCatalog, fetchSourceDetails, fetchSourceFilters, formatSourceError, searchSource } from "./sourceApi";
import { usesWebViewSource, usesFlareDirectSource, shouldDeferCatalogFilters } from "../../lib/platform/webViewSources.js";
import { CatalogCard, CatalogGridSkeleton } from "./CatalogCard";
import { filterItemsByAudioLanguage, sourceSupportsAudioFilter } from "./audioLanguage";
import { CatalogFilters } from "./CatalogFilters";
import { CatalogSourceToolbar } from "./CatalogSourceToolbar";
import {
  catalogItemMatchesFilter,
  catalogViewKey,
  describeCatalogView,
  filterRequestParams,
  filterCatalogItemsByQuery,
  isSearchQueryActive,
  resolveEffectiveFilter,
  shouldUseCatalogScopedSearch,
  applyTaxonomyFilters,
  filterCategoriesForKind,
  isTaxonomyCompatibleWithKind,
  isTaxonomySelectionEmpty,
  sanitizeCatalogKind,
  supportsMultiTaxonomy,
} from "./catalogView";
import { fetchCatalogBatch, resolvePopulatedCatalogPage, shouldFetchCatalogSequentially } from "./catalogPaging";
import { getCatalogSkeletonCount } from "../../lib/catalog/catalogLayout";
import { scrollAppToElement } from "../../lib/platform/scrollRoot";
import { cancelCloudflarePending } from "../../lib/platform/mangalikNative.js";

import { CatalogCarouselNav } from "./CatalogCarouselNav";
import { CatalogLoadingToast } from "./CatalogLoadingToast";
import {
  CATALOG_SNAPSHOT_MAX_AGE_MS,
  CATALOG_STATE_KEY,
  catalogFiltersCache,
  catalogLiveViewCache,
  EMPTY_CATALOG_STATE,
  invalidateCatalogSnapshots,
  readCatalogSnapshot,
  readCatalogState,
  resolveCatalogBoot,
  writeCatalogSnapshot,
  writeCatalogStateSync,
} from "./catalogCache";

export function SourcesScreen({ sources, activeSourceId, onSetActiveSource, sourcePreferences, openLiveManga, openLiveChapter, navigate }) {
  const { pushToast } = useToast();
  const { t } = useI18n();
  const activeSource = sources.find((entry) => entry.id === activeSourceId) || sources[0] || initialSources[0];
  const profile = getSourceProfile(activeSource.id);
  const sourceRemoved = !isKnownSourceId(activeSourceId);
  const preference = { ...initialSourcePreferences[activeSource.id], ...sourcePreferences[activeSource.id] };
  const effectiveMode = preference.mode;
  const selectedItems = preference.selectedItems || [];
  const boot = resolveCatalogBoot(activeSource.id, activeSource.enabled !== false, effectiveMode);
  const [items, setItems] = useState(boot.items);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState(boot.query);
  const [status, setStatus] = useState(boot.status);
  const [error, setError] = useState("");
  const [page, setPage] = useState(boot.page);
  const [hasMore, setHasMore] = useState(boot.hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [slideDirection, setSlideDirection] = useState("next");
  const [selectedLiveItems, setSelectedLiveItems] = useState(selectedItems);
  const cachedFilters = catalogFiltersCache.get(activeSource.id);
  const [filters, setFilters] = useState(cachedFilters || { categories: [], tags: [], kinds: [] });
  const [filtersSourceId, setFiltersSourceId] = useState(activeSource.id);
  const [filtersLoading, setFiltersLoading] = useState(!cachedFilters && effectiveMode === "full" && activeSource.enabled !== false);
  const [selectedFilter, setSelectedFilter] = useState(boot.filter);
  const [selectedKind, setSelectedKind] = useState(boot.kind);
  const [selectedAudioFilter, setSelectedAudioFilter] = useState(boot.audioFilter || "all");
  const [, setCatalogState] = usePersistedState(CATALOG_STATE_KEY, EMPTY_CATALOG_STATE);
  const swipeStart = useRef(0);
  const queryTimer = useRef(null);
  const catalogAnchorRef = useRef(null);

  const scrollToCatalogTop = () => {
    scrollAppToElement(catalogAnchorRef.current, { behavior: "auto", offset: 8 });
  };

  const rememberCatalogView = (sourceId, filter, kind, catalogQuery, nextPage, nextHasMore, nextItems = items, audioFilter = selectedAudioFilter) => {
    const key = catalogViewKey(sourceId, filter, catalogQuery, kind);
    const safeItems = Array.isArray(nextItems) ? nextItems : [];
    writeCatalogSnapshot(sourceId, filter, nextPage, safeItems, nextHasMore, catalogQuery, kind);
    catalogLiveViewCache.set(sourceId, {
      filter,
      kind,
      audioFilter,
      query: catalogQuery,
      page: nextPage,
      hasMore: nextHasMore,
      items: safeItems,
    });
    const prev = readCatalogState();
    const nextState = {
      pages: { ...prev.pages, [key]: nextPage },
      filters: { ...prev.filters, [sourceId]: filter || null },
      kinds: { ...(prev.kinds || {}), [sourceId]: kind || null },
      audioFilters: { ...(prev.audioFilters || {}), [sourceId]: audioFilter || "all" },
      queries: { ...(prev.queries || {}), [sourceId]: catalogQuery || "" },
      hasMore: { ...(prev.hasMore || {}), [key]: nextHasMore },
    };
    writeCatalogStateSync(nextState);
    setCatalogState(nextState);
  };

  function getActiveFilter(kind = selectedKind, taxonomy = selectedFilter) {
    return resolveEffectiveFilter(kind, taxonomy);
  }

  async function fetchCatalogPageSingle(sourceId, kind, taxonomy, pageToLoad) {
    const data = await fetchCatalog(sourceId, {
      page: pageToLoad,
      ...filterRequestParams(getActiveFilter(kind, taxonomy)),
    });
    let nextItems = applyTaxonomyFilters(data.items || [], taxonomy);
    if (kind?.slug && kind.slug !== "all") {
      nextItems = nextItems.filter((item) => catalogItemMatchesFilter(item, kind));
    }
    return {
      ...data,
      items: nextItems,
    };
  }

  async function fetchSearchPageSingle(sourceId, kind, taxonomy, catalogQuery, pageToLoad) {
    if (shouldUseCatalogScopedSearch(sourceId, kind, taxonomy, catalogQuery)) {
      const data = await fetchCatalogPageSingle(sourceId, kind, taxonomy, pageToLoad);
      let nextItems = filterCatalogItemsByQuery(data.items || [], catalogQuery);
      if (kind?.slug && kind.slug !== "all") {
        nextItems = nextItems.filter((item) => catalogItemMatchesFilter(item, kind));
      }
      return {
        items: nextItems,
        hasMore: Boolean(data.hasMore),
      };
    }

    const data = await searchSource(sourceId, catalogQuery.trim(), {
      page: pageToLoad,
      ...filterRequestParams(getActiveFilter(kind, taxonomy)),
    });
    let nextItems = applyTaxonomyFilters(data.items || [], taxonomy);
    if (kind?.slug && kind.slug !== "all") {
      nextItems = nextItems.filter((item) => catalogItemMatchesFilter(item, kind));
    }
    return {
      items: nextItems,
      hasMore: Boolean(data.hasMore) || nextItems.length >= 20,
    };
  }

  async function fetchCatalogPage(sourceId, kind, taxonomy, uiPage) {
    return fetchCatalogBatch(
      (serverPage) => fetchCatalogPageSingle(sourceId, kind, taxonomy, serverPage),
      uiPage,
      undefined,
      { sequential: shouldFetchCatalogSequentially(sourceId) },
    );
  }

  async function fetchSearchPage(sourceId, kind, taxonomy, catalogQuery, uiPage) {
    return fetchCatalogBatch(
      (serverPage) => fetchSearchPageSingle(sourceId, kind, taxonomy, catalogQuery, serverPage),
      uiPage,
      undefined,
      { sequential: shouldFetchCatalogSequentially(sourceId) },
    );
  }

  async function refreshCatalog({
    sourceId = activeSource.id,
    filter: taxonomy = selectedFilter,
    kind = selectedKind,
    catalogQuery = query,
    page: targetPage = page,
    notify = false,
    silent = false,
  } = {}) {
    const stored = readCatalogState();
    const viewKey = catalogViewKey(sourceId, taxonomy, catalogQuery, kind);
    const pageToLoad = targetPage ?? stored.pages?.[viewKey] ?? 1;
    const searchActive = isSearchQueryActive(catalogQuery);

    if (!silent) {
      setStatus("loading");
      setError("");
    }
    if (searchActive) setSearching(true);

    try {
      const source = sources.find((entry) => entry.id === sourceId);
      if (source?.enabled === false) {
        setStatus("disabled");
        return;
      }

      const data = searchActive
        ? await fetchSearchPage(sourceId, kind, taxonomy, catalogQuery, pageToLoad)
        : await fetchCatalogPage(sourceId, kind, taxonomy, pageToLoad);
      const nextItems = data.items || [];
      setItems(nextItems);
      setPage(pageToLoad);
      const nextHasMore = Boolean(data.hasMore);
      setHasMore(nextHasMore);
      rememberCatalogView(sourceId, taxonomy, kind, catalogQuery, pageToLoad, nextHasMore, nextItems);
      setStatus("ready");

      if (notify) {
        if (!nextItems.length) {
          pushToast({ type: "info", message: searchActive ? t("sources.noMatches") : t("sources.emptyGenre") });
        } else {
          pushToast({
            type: "success",
            message: searchActive ? t("sources.foundN", { count: nextItems.length }) : t("sources.catalogLoaded"),
          });
        }
      }
    } catch (reason) {
      if (!silent) {
        const sourceName = getSourceProfile(sourceId).name;
        const fallback = searchActive ? t("sources.searchFailedNamed", { name: sourceName }) : t("sources.loadFailedNamed", { name: sourceName });
        const message = formatSourceError(reason, fallback);
        setError(message);
        setStatus("error");
        if (notify) pushToast({ type: "error", message });
      }
    } finally {
      setSearching(false);
    }
  }

  async function loadCatalogPageForNavigation(targetPage) {
    const cached = readCatalogSnapshot(activeSource.id, selectedFilter, targetPage, query, selectedKind);
    if (cached?.items?.length) {
      return {
        page: targetPage,
        items: cached.items,
        hasMore: Boolean(cached.hasMore),
      };
    }

    const data = isSearchQueryActive(query)
      ? await fetchSearchPage(activeSource.id, selectedKind, selectedFilter, query, targetPage)
      : await fetchCatalogPage(activeSource.id, selectedKind, selectedFilter, targetPage);
    return {
      page: targetPage,
      items: data.items || [],
      hasMore: Boolean(data.hasMore),
    };
  }

  function applyCatalogPageResult(result, direction) {
    setSlideDirection(direction);
    setItems(result.items);
    setPage(result.page);
    setHasMore(result.hasMore);
    rememberCatalogView(
      activeSource.id,
      selectedFilter,
      selectedKind,
      query,
      result.page,
      result.hasMore,
      result.items,
    );
    setError("");
    scrollToCatalogTop();
  }

  async function goToPage(targetPage) {
    if (loadingMore || targetPage < 1 || targetPage === page) return page;

    if (targetPage > page && !hasMore && items.length) {
      pushToast({
        type: "info",
        message: t("sources.pageClamped", { requested: targetPage, page }),
      });
      return page;
    }

    const direction = targetPage > page ? "next" : "prev";
    setLoadingMore(true);
    try {
      const resolved = await resolvePopulatedCatalogPage(
        targetPage,
        (pageToLoad) => loadCatalogPageForNavigation(pageToLoad),
      );

      if (!resolved?.items?.length) {
        pushToast({ type: "info", message: t("sources.pageUnavailable") });
        return page;
      }

      if (resolved.clampedFrom && resolved.clampedFrom !== resolved.page) {
        pushToast({
          type: "info",
          message: t("sources.pageClamped", { requested: resolved.clampedFrom, page: resolved.page }),
        });
      }

      applyCatalogPageResult(resolved, direction);
      return resolved.page;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t("sources.pageLoadFailed");
      setError(message);
      pushToast({ type: "error", message });
      return page;
    } finally {
      setLoadingMore(false);
    }
  }

  async function changePage(targetPage, direction) {
    if (loadingMore || targetPage < 1 || (targetPage > page && !hasMore)) return;

    const cached = readCatalogSnapshot(activeSource.id, selectedFilter, targetPage, query, selectedKind);
    if (cached?.items?.length) {
      setSlideDirection(direction);
      setItems(cached.items);
      setPage(targetPage);
      setHasMore(Boolean(cached.hasMore));
      setError("");
      rememberCatalogView(activeSource.id, selectedFilter, selectedKind, query, targetPage, cached.hasMore, cached.items);
      scrollToCatalogTop();
      return;
    }

    setLoadingMore(true);
    try {
      const data = isSearchQueryActive(query)
        ? await fetchSearchPage(activeSource.id, selectedKind, selectedFilter, query, targetPage)
        : await fetchCatalogPage(activeSource.id, selectedKind, selectedFilter, targetPage);
      const nextItems = data.items || [];
      setSlideDirection(direction);
      setItems(nextItems);
      setPage(targetPage);
      const nextHasMore = Boolean(data.hasMore);
      setHasMore(nextHasMore);
      rememberCatalogView(activeSource.id, selectedFilter, selectedKind, query, targetPage, nextHasMore, nextItems);
      setError("");
      scrollToCatalogTop();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t("sources.pageLoadFailed");
      setError(message);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      void cancelCloudflarePending();
    }

    const nextBoot = resolveCatalogBoot(activeSource.id, activeSource.enabled !== false, effectiveMode);
    const savedFilter = nextBoot.filter;
    const savedKind = sanitizeCatalogKind(
      activeSource.id,
      nextBoot.kind ? enrichKindWithFilterPath(nextBoot.kind, activeSource.id) : null,
    );
    const savedQuery = nextBoot.query;
    const savedPage = nextBoot.page;
    const cached = readCatalogSnapshot(activeSource.id, savedFilter, savedPage, savedQuery, savedKind);

    setSlideDirection("next");
    setSelectedFilter(savedFilter);
    setSelectedKind(savedKind);
    setSelectedAudioFilter(nextBoot.audioFilter || "all");
    setQuery(savedQuery);
    setPage(savedPage);
    setHasMore(nextBoot.hasMore);

    if (activeSource.enabled === false) {
      setItems([]);
      setStatus("disabled");
      return;
    }
    if (effectiveMode === "selected") {
      setItems([]);
      setStatus("ready");
      return;
    }

    if (cached?.items?.length) {
      setItems(cached.items);
      setStatus("ready");
      const stale = Date.now() - (cached.at || 0) > CATALOG_SNAPSHOT_MAX_AGE_MS;
      if (stale) void refreshCatalog({ filter: savedFilter, kind: savedKind, catalogQuery: savedQuery, page: savedPage, silent: true });
      return;
    }

    setItems([]);
    void refreshCatalog({ filter: savedFilter, kind: savedKind, catalogQuery: savedQuery, page: savedPage });
  }, [activeSource.id, activeSource.enabled, effectiveMode]);

  useEffect(() => {
    if (effectiveMode !== "full" || activeSource.enabled === false) {
      setFiltersLoading(false);
      return undefined;
    }

    const shouldDeferFilters = shouldDeferCatalogFilters(activeSource.id) && status === "loading";
    if (shouldDeferFilters) {
      return undefined;
    }

    const cached = catalogFiltersCache.get(activeSource.id);
    if (cached) {
      catalogFiltersCache.set(activeSource.id, cached);
      setFiltersSourceId(activeSource.id);
      setFilters(cached);
      setFiltersLoading(false);
      return undefined;
    }

    let cancelled = false;
    // Ne pas laisser les kinds/catégories de la source précédente (ex. French Stream)
    // filtrer MangaLik → grille vide (أفلام / مسلسلات).
    setFiltersSourceId(activeSource.id);
    setFilters({ categories: [], tags: [], kinds: [] });
    setFiltersLoading(true);
    fetchSourceFilters(activeSource.id).then((data) => {
      if (cancelled) return;
      const nextFilters = {
        categories: data.categories || data.genres || [],
        tags: data.tags || [],
        kinds: data.kinds || [],
      };
      catalogFiltersCache.set(activeSource.id, nextFilters);
      setFiltersSourceId(activeSource.id);
      setFilters(nextFilters);
    }).catch(() => {
      if (!cancelled) {
        setFiltersSourceId(activeSource.id);
        setFilters({ categories: [], tags: [], kinds: [] });
      }
    }).finally(() => {
      if (!cancelled) setFiltersLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeSource.enabled, activeSource.id, effectiveMode, status]);

  useEffect(() => () => {
    if (queryTimer.current) clearTimeout(queryTimer.current);
  }, []);

  useEffect(() => {
    if (effectiveMode !== "selected" || activeSource.enabled === false || !selectedItems.length) {
      setSelectedLiveItems(selectedItems);
      return undefined;
    }
    let cancelled = false;
    setSelectedLiveItems(selectedItems);
    Promise.all(selectedItems.map(async (item) => {
      if (item.recentChapters?.length >= 2) return item;
      try {
        const details = await fetchSourceDetails(activeSource.id, item.url);
        return { ...item, recentChapters: (details.chapters || []).slice(0, 2) };
      } catch {
        return item;
      }
    })).then((enriched) => { if (!cancelled) setSelectedLiveItems(enriched); });
    return () => { cancelled = true; };
  }, [activeSource.enabled, activeSource.id, effectiveMode, selectedItems]);

  const visible = filterItemsByAudioLanguage(
    effectiveMode === "full"
      ? items
      : selectedLiveItems.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase())),
    selectedAudioFilter,
  );
  const unitLabel = profile.contentTypes?.length === 1
    ? (contentTypes[profile.contentTypes[0]]?.singular || t("common.content"))
    : activeSource.id === "azorafly"
      ? t("sources.work")
      : profile.contentTypes?.includes("movie") || profile.contentTypes?.includes("series")
        ? t("sources.titleWord")
      : profile.contentTypes?.includes("anime") && !profile.contentTypes?.includes("manga")
        ? contentTypes.anime.singular
        : contentTypes.manga.singular;
  const mediaKindsFallback = defaultContentKinds(activeSource.id);
  const kindsForActiveSource = filtersSourceId === activeSource.id ? (filters.kinds || []) : [];
  const visibleCategories = useMemo(
    () => filterCategoriesForKind(
      filtersSourceId === activeSource.id ? filters.categories : [],
      selectedKind,
    ),
    [filters.categories, filtersSourceId, activeSource.id, selectedKind],
  );

  function handleOpenLiveManga(item) {
    rememberCatalogView(activeSource.id, selectedFilter, selectedKind, query, page, hasMore, items);
    openLiveManga(item);
  }

  function applyAudioFilter(nextAudioFilter) {
    const audioFilter = nextAudioFilter || "all";
    setSelectedAudioFilter(audioFilter);
    const prev = readCatalogState();
    const nextState = {
      ...prev,
      audioFilters: { ...(prev.audioFilters || {}), [activeSource.id]: audioFilter },
    };
    writeCatalogStateSync(nextState);
    setCatalogState(nextState);
    catalogLiveViewCache.set(activeSource.id, {
      ...(catalogLiveViewCache.get(activeSource.id) || {}),
      audioFilter,
    });
  }

  function applyKindFilter(nextKind) {
    const rawKind = !nextKind || nextKind.slug === "all"
      ? null
      : enrichKindWithFilterPath({ ...nextKind, type: "kind" }, activeSource.id);
    const kind = sanitizeCatalogKind(activeSource.id, rawKind);
    const nextFilter = kind && selectedFilter && !isTaxonomyCompatibleWithKind(selectedFilter, kind)
      ? null
      : selectedFilter;
    invalidateCatalogSnapshots(activeSource.id);
    clearSourceApiCache();
    setSelectedKind(kind);
    setSelectedFilter(nextFilter);
    setPage(1);
    setSlideDirection("next");
    void refreshCatalog({ kind, filter: nextFilter, catalogQuery: query, page: 1, notify: true });
  }

  function applyTaxonomyFilter(nextFilter) {
    const filter = !nextFilter || isTaxonomySelectionEmpty(nextFilter) ? null : nextFilter;
    invalidateCatalogSnapshots(activeSource.id);
    clearSourceApiCache();
    setSelectedFilter(filter);
    setPage(1);
    setSlideDirection("next");
    void refreshCatalog({ kind: selectedKind, filter, catalogQuery: query, page: 1, notify: true });
  }

  function updateQuery(value) {
    setQuery(value);
    setPage(1);
    if (queryTimer.current) clearTimeout(queryTimer.current);

    if (isSearchQueryActive(value)) {
      queryTimer.current = setTimeout(() => {
        void refreshCatalog({ kind: selectedKind, filter: selectedFilter, catalogQuery: value, page: 1 });
      }, 350);
      return;
    }

    if (isSearchQueryActive(query)) {
      void refreshCatalog({ kind: selectedKind, filter: selectedFilter, catalogQuery: "", page: 1 });
    }
  }

  function clearQuery() {
    if (queryTimer.current) clearTimeout(queryTimer.current);
    setQuery("");
    setPage(1);
    if (isSearchQueryActive(query)) {
      void refreshCatalog({ kind: selectedKind, filter: selectedFilter, catalogQuery: "", page: 1 });
    }
  }

  const viewDescription = effectiveMode === "full"
    ? describeCatalogView({ query, filter: selectedFilter, kind: selectedKind, page })
    : t("sources.settingsOnly");
  const catalogInitialBusy = status === "loading" || searching;
  const catalogPaging = loadingMore;
  const catalogBusy = catalogInitialBusy || catalogPaging;
  const skeletonCount = getCatalogSkeletonCount();
  const skeletonType = selectedKind?.slug && selectedKind.slug !== "all"
    ? selectedKind.slug
    : (profile.contentTypes?.length === 1 ? profile.contentTypes[0] : "manga");
  const reloadLabel = isSearchQueryActive(query)
    ? t("sources.searching", { name: profile.name })
    : t("sources.fetching", { name: profile.name });
  const connectingHint = (usesWebViewSource(activeSource.id) || usesFlareDirectSource(activeSource.id))
    ? t("sources.connectingCloudflare")
    : t("sources.connecting");

  return (
    <div className="screen screen--discover">
      <Header title={t("home.discover")} eyebrow={t("sources.catalogOf", { name: profile.name })} onSearch={() => navigate("search")} onReadingHistory={() => navigate("reading-history")} onNotifications={() => navigate("updates")} />
      <main className="content live-catalog">
        <CatalogSourceToolbar
          sources={sources}
          activeSourceId={activeSourceId}
          onSetActiveSource={onSetActiveSource}
          onOpenSettings={() => navigate("source-management")}
        />
        <div className="search-box catalog-search"><span className="catalog-search__icon"><Search size={18} /></span><input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder={effectiveMode === "full" ? t("sources.searchCatalog", { name: profile.name }) : t("sources.searchSaved")} aria-label={t("sources.searchCatalogAria", { name: profile.name })} />{query && <button className="catalog-search__clear" onClick={clearQuery} aria-label={t("common.clearSearch")}><X size={15} /></button>}<span className="catalog-search__source">{profile.initials}</span></div>
        {effectiveMode === "full" && activeSource.enabled !== false && (
          <CatalogFilters
            categories={visibleCategories}
            tags={filtersSourceId === activeSource.id ? filters.tags : []}
            kinds={kindsForActiveSource.length ? kindsForActiveSource : mediaKindsFallback}
            selected={selectedFilter}
            selectedKind={selectedKind}
            selectedAudioFilter={selectedAudioFilter}
            showAudioFilter={sourceSupportsAudioFilter(activeSource.id)}
            onSelectAudioFilter={applyAudioFilter}
            loading={filtersLoading}
            multiSelect={supportsMultiTaxonomy(activeSource.id)}
            onSelectKind={applyKindFilter}
            onSelect={applyTaxonomyFilter}
          />
        )}
        {sourceRemoved ? (
          <div className="live-error">
            <Wifi size={30} />
            <h2>{t("sources.sourceRemovedTitle")}</h2>
            <p>{t("sources.sourceRemovedHint")}</p>
            <button
              className="button button--primary"
              type="button"
              onClick={() => onSetActiveSource(sources.find((entry) => entry.enabled !== false)?.id || initialSources[0]?.id)}
            >
              <RefreshCw size={17} /> {t("sources.pickAnotherSource")}
            </button>
          </div>
        ) : status === "disabled" ? <div className="live-error"><Wifi size={30} /><h2>{t("sources.sourceOffline")}</h2><p>{t("sources.enableFromSettings")}</p></div> : status === "error" ? <div className="live-error"><Wifi size={30} /><h2>{t("sources.connectFailed", { name: profile.name })}</h2><p>{error}</p><button className="button button--primary" onClick={() => refreshCatalog({ kind: selectedKind, filter: selectedFilter, catalogQuery: query, page, notify: true })}><RefreshCw size={17} /> {t("common.retry")}</button></div> : <>
          <CatalogLoadingToast
            visible={catalogBusy}
            label={reloadLabel}
            hint={catalogInitialBusy ? connectingHint : ""}
          />
          <div className="live-catalog__meta" ref={catalogAnchorRef}><strong>{catalogBusy ? "…" : `${visible.length} ${unitLabel}`}</strong><span>{catalogBusy ? reloadLabel : viewDescription}</span></div>
          {catalogInitialBusy ? (
            <CatalogGridSkeleton mediaType={skeletonType} count={skeletonCount} label={reloadLabel} />
          ) : (
            <>
          <div
            className={`catalog-page-carousel catalog-page-carousel--${slideDirection}${catalogPaging ? " is-paging" : ""}`}
            key={`${activeSource.id}-${catalogViewKey(activeSource.id, selectedFilter, query, selectedKind)}-page-${page}`}
            onTouchStart={(event) => { swipeStart.current = event.touches[0].clientX; }}
            onTouchEnd={(event) => { if (effectiveMode !== "full" || loadingMore) return; const distance = event.changedTouches[0].clientX - swipeStart.current; if (Math.abs(distance) < 55) return; if (distance < 0) changePage(page + 1, "next"); else changePage(page - 1, "prev"); }}
            aria-busy={catalogPaging}
          >
            <div className="live-manga-grid">{visible.map((item) => <CatalogCard key={item.url} item={item} profile={profile} onOpenDetails={handleOpenLiveManga} onOpenChapter={openLiveChapter} />)}</div>
          </div>
          {!visible.length && !catalogPaging && <div className="empty-state"><Search size={31} /><h2>{effectiveMode === "selected" ? t("sources.noTitlesYet") : t("sources.noResults")}</h2><p>{effectiveMode === "selected" ? t("sources.pickMangaNovels") : t("sources.tryOtherName")}</p>{effectiveMode === "selected" && <button className="button button--primary" onClick={() => navigate("source-management")}>{t("sources.managePicks")}</button>}</div>}
            </>
          )}
          {effectiveMode === "full" && (visible.length > 0 || loadingMore) && (
            <CatalogCarouselNav
              page={page}
              hasMore={hasMore}
              loadingMore={loadingMore}
              error={error}
              onPrevious={() => changePage(page - 1, "prev")}
              onNext={() => changePage(page + 1, "next")}
              onGoToPage={goToPage}
            />
          )}
        </>}
      </main>
    </div>
  );
}
