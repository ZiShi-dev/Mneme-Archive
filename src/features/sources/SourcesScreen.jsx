import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Search, Wifi, X } from "lucide-react";
import { useToast } from "../../components/ui/ToastProvider";
import { defaultContentKinds, enrichKindWithFilterPath, getSourceProfile, initialSourcePreferences, initialSources } from "../../config/sources";
import { useI18n } from "../../i18n/I18nProvider";
import { usePersistedState } from "../../hooks/usePersistedState";
import { kvGetSync, kvSet } from "../../lib/storage/initStorage";
import { contentTypes } from "./contentTypes";
import { Header } from "../../components/layout/Header";
import { clearSourceApiCache, fetchCatalog, fetchSourceDetails, fetchSourceFilters, searchSource } from "./sourceApi";
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
  supportsMultiTaxonomy,
} from "./catalogView";
import { fetchCatalogBatch, resolvePopulatedCatalogPage } from "./catalogPaging";
import { getCatalogSkeletonCount } from "../../lib/catalog/catalogLayout";
import { scrollAppToElement } from "../../lib/platform/scrollRoot";

const CATALOG_STATE_KEY = "living-archive:catalog-state";
const EMPTY_CATALOG_STATE = { pages: {}, filters: {}, kinds: {}, queries: {}, hasMore: {}, audioFilters: {} };
const CATALOG_SNAPSHOT_MAX_AGE_MS = 2 * 60 * 1000;
const catalogSnapshotCache = new Map();
const catalogFiltersCache = new Map();
const catalogLiveViewCache = new Map();

function readCatalogState() {
  return kvGetSync(CATALOG_STATE_KEY, EMPTY_CATALOG_STATE);
}

function writeCatalogStateSync(nextState) {
  void kvSet(CATALOG_STATE_KEY, nextState);
}

function catalogSnapshotKey(sourceId, filter, page, query = "", kind = null) {
  return `${catalogViewKey(sourceId, filter, query, kind)}:p${page}`;
}

function readCatalogSnapshot(sourceId, filter, page, query = "", kind = null) {
  return catalogSnapshotCache.get(catalogSnapshotKey(sourceId, filter, page, query, kind));
}

function writeCatalogSnapshot(sourceId, filter, page, items, hasMore, query = "", kind = null) {
  if (!Array.isArray(items) || !items.length) return;
  catalogSnapshotCache.set(catalogSnapshotKey(sourceId, filter, page, query, kind), {
    items,
    hasMore: Boolean(hasMore),
    at: Date.now(),
  });
}

function invalidateCatalogSnapshots(sourceId) {
  const prefix = `${sourceId}:`;
  for (const key of catalogSnapshotCache.keys()) {
    if (key.startsWith(prefix)) catalogSnapshotCache.delete(key);
  }
}

function resolveCatalogBoot(sourceId, enabled, mode) {
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
  const kind = live?.kind ?? stored.kinds?.[sourceId] ?? null;
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

function CatalogCarouselNav({ page, hasMore, loadingMore, error, onPrevious, onNext, onGoToPage }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draftPage, setDraftPage] = useState(String(page));

  useEffect(() => {
    setDraftPage(String(page));
  }, [page]);

  const commitPage = async () => {
    const nextPage = Number.parseInt(draftPage, 10);
    if (!Number.isFinite(nextPage) || nextPage < 1) {
      setDraftPage(String(page));
      return;
    }
    if (nextPage === page) return;
    const landedPage = await onGoToPage(nextPage);
    setDraftPage(String(typeof landedPage === "number" ? landedPage : page));
  };

  const navLabel = `${t("sources.catalogNav")} — ${t("sources.view.page", { page })}`;

  return (
    <section
      className={`catalog-carousel-nav${open ? " is-open" : ""}`}
      aria-label={navLabel}
    >
      <div className="catalog-carousel-nav__shell">
        <div className="catalog-carousel-nav__rail">
          <button
            type="button"
            className="catalog-carousel-nav__icon"
            onClick={onPrevious}
            disabled={page === 1 || loadingMore}
            aria-label={t("common.previous")}
          >
            <ChevronRight size={16} />
          </button>

          <button
            type="button"
            className="catalog-carousel-nav__page"
            onClick={() => setOpen(true)}
            aria-label={open ? navLabel : t("sources.catalogNavShow")}
          >
            <span className="catalog-carousel-nav__page-value">{page}</span>
            {!open && <span className="catalog-carousel-nav__page-label">{t("common.page")}</span>}
          </button>

          <button
            type="button"
            className="catalog-carousel-nav__icon"
            onClick={onNext}
            disabled={!hasMore || loadingMore}
            aria-label={t("common.next")}
          >
            <ChevronLeft size={16} />
          </button>

          <span className="catalog-carousel-nav__divider" aria-hidden="true" />

          <button
            type="button"
            className="catalog-carousel-nav__icon catalog-carousel-nav__icon--toggle"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-label={open ? t("sources.catalogNavHide") : t("sources.catalogNavShow")}
          >
            <ChevronDown size={15} />
          </button>
        </div>

        {open && (
          <div className="catalog-carousel-nav__drawer">
            <p className="catalog-carousel-nav__hint catalog-carousel-nav__hint--touch">{t("sources.swipeHint")}</p>
            <label className="catalog-carousel-nav__jump">
              <span>{t("sources.goToPage")}</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                className="catalog-carousel-nav__jump-input"
                value={draftPage}
                onChange={(event) => setDraftPage(event.target.value)}
                onBlur={commitPage}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitPage();
                    event.currentTarget.blur();
                  }
                }}
                aria-label={t("sources.pageNumber")}
                disabled={loadingMore}
              />
            </label>
          </div>
        )}
      </div>
      {error && <p className="catalog-carousel-nav__error">{error}</p>}
    </section>
  );
}

export function SourcesScreen({ sources, activeSourceId, onSetActiveSource, sourcePreferences, openLiveManga, openLiveChapter, navigate }) {
  const { pushToast } = useToast();
  const { t } = useI18n();
  const activeSource = sources.find((entry) => entry.id === activeSourceId) || sources[0] || initialSources[0];
  const profile = getSourceProfile(activeSource.id);
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
    );
  }

  async function fetchSearchPage(sourceId, kind, taxonomy, catalogQuery, uiPage) {
    return fetchCatalogBatch(
      (serverPage) => fetchSearchPageSingle(sourceId, kind, taxonomy, catalogQuery, serverPage),
      uiPage,
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
        const message = reason instanceof Error ? reason.message : searchActive ? t("sources.searchFailedNamed", { name: sourceName }) : t("sources.loadFailedNamed", { name: sourceName });
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
    const nextBoot = resolveCatalogBoot(activeSource.id, activeSource.enabled !== false, effectiveMode);
    const savedFilter = nextBoot.filter;
    const savedKind = nextBoot.kind
      ? enrichKindWithFilterPath(nextBoot.kind, activeSource.id)
      : null;
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

    const cached = catalogFiltersCache.get(activeSource.id);
    if (cached) {
      catalogFiltersCache.set(activeSource.id, cached);
      setFilters(cached);
      setFiltersLoading(false);
      return undefined;
    }

    let cancelled = false;
    setFiltersLoading(true);
    fetchSourceFilters(activeSource.id).then((data) => {
      if (cancelled) return;
      const nextFilters = {
        categories: data.categories || data.genres || [],
        tags: data.tags || [],
        kinds: data.kinds || [],
      };
      catalogFiltersCache.set(activeSource.id, nextFilters);
      setFilters(nextFilters);
    }).catch(() => {
      if (!cancelled) setFilters({ categories: [], tags: [], kinds: [] });
    }).finally(() => {
      if (!cancelled) setFiltersLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeSource.enabled, activeSource.id, effectiveMode]);

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
  const visibleCategories = useMemo(
    () => filterCategoriesForKind(filters.categories, selectedKind),
    [filters.categories, selectedKind],
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
    const kind = !nextKind || nextKind.slug === "all"
      ? null
      : enrichKindWithFilterPath({ ...nextKind, type: "kind" }, activeSource.id);
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
            tags={filters.tags}
            kinds={filters.kinds?.length ? filters.kinds : mediaKindsFallback}
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
        {status === "disabled" ? <div className="live-error"><Wifi size={30} /><h2>{t("sources.sourceOffline")}</h2><p>{t("sources.enableFromSettings")}</p></div> : status === "error" ? <div className="live-error"><Wifi size={30} /><h2>{t("sources.connectFailed", { name: profile.name })}</h2><p>{error}</p><button className="button button--primary" onClick={() => refreshCatalog({ kind: selectedKind, filter: selectedFilter, catalogQuery: query, page, notify: true })}><RefreshCw size={17} /> {t("common.retry")}</button></div> : <>
          <div className="live-catalog__meta" ref={catalogAnchorRef}><strong>{catalogBusy ? "…" : `${visible.length} ${unitLabel}`}</strong><span>{catalogBusy ? reloadLabel : viewDescription}</span></div>
          {catalogInitialBusy ? (
            <>
              <div className="catalog-reload" role="status" aria-live="polite">
                <RefreshCw size={15} aria-hidden="true" />
                <span>
                  <strong>{reloadLabel}</strong>
                  <small>{t("sources.connecting")}</small>
                </span>
              </div>
              <CatalogGridSkeleton mediaType={skeletonType} count={skeletonCount} label={reloadLabel} />
            </>
          ) : (
            <>
          <div
            className={`catalog-page-carousel catalog-page-carousel--${slideDirection}${catalogPaging ? " is-paging" : ""}`}
            key={`${activeSource.id}-${catalogViewKey(activeSource.id, selectedFilter, query, selectedKind)}-page-${page}`}
            onTouchStart={(event) => { swipeStart.current = event.touches[0].clientX; }}
            onTouchEnd={(event) => { if (effectiveMode !== "full" || loadingMore) return; const distance = event.changedTouches[0].clientX - swipeStart.current; if (Math.abs(distance) < 55) return; if (distance < 0) changePage(page + 1, "next"); else changePage(page - 1, "prev"); }}
            aria-busy={catalogPaging}
          >
            {catalogPaging && (
              <div className="catalog-page-carousel__status" role="status" aria-live="polite">
                <RefreshCw size={16} aria-hidden="true" />
                <span>{reloadLabel}</span>
              </div>
            )}
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
