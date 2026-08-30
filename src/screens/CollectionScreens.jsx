import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownAZ, Bell, BookOpen, Bookmark, Check, CheckCheck, ChevronLeft, Clapperboard, Clock3, Globe2, RefreshCw, Search, Settings2, Sparkles } from "lucide-react";
import { Header } from "../components/layout/Header";
import { SectionTitle } from "../components/layout/SectionTitle";
import { Cover } from "../components/manga/Cover";
import { ChipFilterBar, ChipFilterButton } from "../components/ui/ChipFilterBar";
import { EmptyState } from "../components/ui/EmptyState";
import { AccessibleSearchField } from "../components/ui/AccessibleSearchField";
import { manga } from "../data/demoManga";
import { VISIBLE_MEDIA_TYPES, isChromebookApp, isNotifiableMediaType } from "../config/appFlavor";
import { getSourceProfile } from "../config/sources";
import { RemoteCover, SEARCH_RESULTS_PAGE_SIZE, SearchResultsList, SearchResultsPagination, SearchResultsSkeleton, SourceLogo, COLLECTION_DESKTOP_PAGE_SIZE, COLLECTION_PAGE_SIZE } from "../features/sources";
import { contentTypes, getItemType } from "../features/sources/contentTypes";
import { SourceScopeBar } from "../components/sources/SourceScopeBar";
import { filterItemsByAudioLanguage } from "../features/sources/audioLanguage";
import { getEnabledSources, flattenSearchBatches, searchEnabledSources, sourceSupportsMediaType } from "../lib/unifiedSearch";
import { useToast } from "../components/ui/ToastProvider";
import { FavoritesOverview } from "./FavoritesOverview";
import { RemoteCover as UpdatesRemoteCover } from "../features/sources/RemoteCover";
import { formatRelativeReadingTime, getHistoryDayGroup, historyDayGroupLabel } from "../lib/readingProgress";
import { formatFollowUpdateLine, resolveFollowMediaType } from "../lib/updates/followMessaging";
import { isVideoMediaType } from "../features/sources/mediaPresentation";
import { UpdatesEmptyPanel } from "../features/updates/UpdatesEmptyPanel";
import { UpdatesFollowedPreview } from "../features/updates/UpdatesFollowedPreview";
import { useI18n } from "../i18n/I18nProvider";

function resolveUpdateMediaType(entry) {
  return entry.mediaType || resolveFollowMediaType(entry);
}

function isVisibleUpdateType(mediaType) {
  return isNotifiableMediaType(mediaType);
}

function isVisibleFavoriteType(mediaType) {
  return isVisibleUpdateType(mediaType);
}

function getBookmarkRowCopy(entry, latestChapter, t) {
  if (entry.kind === "demo") {
    return {
      typeLabel: t("content.mangaSingular"),
      readingLine: t("favorites.chapterOf", { current: entry.item.lastChapter, total: entry.item.chapters }),
      continueLabel: null,
      isVideo: false,
    };
  }

  const typeLabel = contentTypes[entry.type]?.singular || t("content.mangaSingular");
  const isVideo = isVideoMediaType(entry.type);

  if (entry.type === "movie") {
    return {
      typeLabel,
      readingLine: latestChapter
        ? t("favorites.watchMovie", { name: latestChapter.number || latestChapter.name || "?" })
        : t("favorites.openMovie"),
      continueLabel: latestChapter?.url
        ? t("favorites.continueMovie", { name: latestChapter.number || latestChapter.name || "?" })
        : null,
      isVideo,
    };
  }

  if (entry.type === "series") {
    return {
      typeLabel,
      readingLine: latestChapter
        ? t("favorites.lastEpisode", { name: latestChapter.number || latestChapter.name || "?" })
        : t("favorites.openEpisodes"),
      continueLabel: latestChapter?.url
        ? t("favorites.continueEpisode", { name: latestChapter.number || latestChapter.name || "?" })
        : null,
      isVideo,
    };
  }

  return {
    typeLabel,
    readingLine: latestChapter
      ? t("favorites.lastChapter", { name: latestChapter.number || latestChapter.name })
      : t("favorites.openChapters"),
    continueLabel: latestChapter?.url
      ? t("favorites.continueChapter", { name: latestChapter.number || latestChapter.name })
      : null,
    isVideo,
  };
}

function SearchScopeFooter({ enabledSources, sourcePreferences, onManage }) {
  const { t } = useI18n();

  return (
    <SourceScopeBar
      sources={enabledSources}
      sourcePreferences={sourcePreferences}
      onClick={onManage}
      ariaLabel={t("search.manageEnabled")}
    />
  );
}

export function LibraryScreen({ favorites, liveFavorites, toggleFavorite, toggleLiveFavorite, openManga, openLiveManga, openLiveChapter, navigate }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortMode, setSortMode] = useState("saved");
  const [listPage, setListPage] = useState(1);
  const listHeadRef = useRef(null);
  const libraryItems = useMemo(
    () => (isChromebookApp ? [] : manga.filter((item) => favorites.includes(item.id))),
    [favorites],
  );
  const bookmarkedItems = useMemo(() => [
    ...libraryItems.map((item, index) => ({ key: `demo:${item.id}`, kind: "demo", type: "manga", sourceId: "mangalik", sourceName: item.source, item, savedOrder: index })),
    ...liveFavorites
      .filter((item) => isVisibleFavoriteType(getItemType(item)))
      .map((item, index) => ({
        key: `${item.sourceId}:${item.url}`,
        kind: "live",
        type: getItemType(item),
        sourceId: item.sourceId,
        sourceName: getSourceProfile(item.sourceId).name,
        item,
        savedOrder: libraryItems.length + index,
      })),
  ], [libraryItems, liveFavorites]);
  const sourceOptions = useMemo(() => [...new Map(bookmarkedItems.map((entry) => [entry.sourceId, entry.sourceName])).entries()], [bookmarkedItems]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = useMemo(() => bookmarkedItems
    .filter((entry) => typeFilter === "all" || entry.type === typeFilter)
    .filter((entry) => sourceFilter === "all" || entry.sourceId === sourceFilter)
    .filter((entry) => !normalizedQuery || `${entry.item.title} ${entry.item.altTitle || entry.item.subtitle || ""} ${entry.sourceName}`.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => (sortMode === "title" ? a.item.title.localeCompare(b.item.title, locale) : b.savedOrder - a.savedOrder)), [bookmarkedItems, locale, normalizedQuery, sortMode, sourceFilter, typeFilter]);
  const listPageSize = isChromebookApp ? COLLECTION_DESKTOP_PAGE_SIZE : COLLECTION_PAGE_SIZE;
  const totalListPages = Math.max(1, Math.ceil(visibleItems.length / listPageSize));
  const pagedVisibleItems = useMemo(
    () => visibleItems.slice((listPage - 1) * listPageSize, listPage * listPageSize),
    [listPage, listPageSize, visibleItems],
  );

  useEffect(() => {
    setListPage(1);
  }, [normalizedQuery, sortMode, sourceFilter, typeFilter]);

  useEffect(() => {
    if (listPage > totalListPages) setListPage(totalListPages);
  }, [listPage, totalListPages]);

  const goToListPage = (page) => {
    setListPage(page);
    listHeadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const totalItems = bookmarkedItems.length;
  const mangaCount = bookmarkedItems.filter((entry) => entry.type === "manga").length;
  const novelCount = bookmarkedItems.filter((entry) => entry.type === "novel").length;
  const movieCount = bookmarkedItems.filter((entry) => entry.type === "movie").length;
  const seriesCount = bookmarkedItems.filter((entry) => entry.type === "series").length;
  const overviewItems = typeFilter === "all" && sourceFilter === "all" && !normalizedQuery ? bookmarkedItems : visibleItems;
  const overviewPrimaryCount = isChromebookApp
    ? overviewItems.filter((entry) => entry.type === "movie").length
    : overviewItems.filter((entry) => entry.type === "manga" || entry.type === "movie").length;
  const overviewSecondaryCount = isChromebookApp
    ? overviewItems.filter((entry) => entry.type === "series").length
    : overviewItems.filter((entry) => entry.type === "novel" || entry.type === "series").length;
  const previewItems = overviewItems.slice(0, 3);
  const hasActiveFilters = Boolean(query || typeFilter !== "all" || sourceFilter !== "all");

  function resetFilters() {
    setQuery("");
    setTypeFilter("all");
    setSourceFilter("all");
  }

  return (
    <div className={`screen${isChromebookApp ? " screen--favorites-desktop" : ""}`}>
      {isChromebookApp ? (
        <header className="settings-desktop-head">
          <span className="eyebrow">{totalItems ? t("favorites.savedN", { count: totalItems }) : t("favorites.personal")}</span>
          <h1>{t("favorites.title")}</h1>
        </header>
      ) : (
        <Header title={t("favorites.title")} eyebrow={totalItems ? t("favorites.savedN", { count: totalItems }) : t("favorites.personal")} onSearch={() => navigate("search")} onReadingHistory={() => navigate("reading-history")} onNotifications={() => navigate("updates")} />
      )}
      <main className="content bookmarks-page">
        {totalItems > 0 && (
          <FavoritesOverview
            totalItems={overviewItems.length}
            mangaCount={overviewPrimaryCount}
            novelCount={overviewSecondaryCount}
            sourceCount={new Set(overviewItems.map((entry) => entry.sourceId)).size}
            previewItems={previewItems}
            variant={isChromebookApp ? "video" : "reading"}
            desktop={isChromebookApp}
            onDiscover={() => navigate("sources")}
          />
        )}

        {totalItems > 0 && (
          <section className="bookmarks-controls" aria-label={t("favorites.filterAria")}>
            <AccessibleSearchField
              className="global-search bookmarks-controls__search"
              value={query}
              onChange={setQuery}
              placeholder={t("favorites.searchPlaceholder")}
              ariaLabel={t("favorites.searchAria")}
            />

            <ChipFilterBar variant="segmented" role="tablist" ariaLabel={t("favorites.contentType")} className="bookmarks-controls__types">
              {[
                { id: "all", label: t("content.all"), count: totalItems },
                ...(isChromebookApp
                  ? [
                      { id: "movie", label: t("content.movie"), count: movieCount },
                      { id: "series", label: t("content.series"), count: seriesCount },
                    ]
                  : [
                      { id: "manga", label: t("content.manga"), count: mangaCount },
                      { id: "novel", label: t("content.novel"), count: novelCount },
                    ]),
              ].map((type) => (
                <ChipFilterButton
                  key={type.id}
                  role="tab"
                  active={typeFilter === type.id}
                  disabled={!type.count && type.id !== "all"}
                  count={type.count}
                  onClick={() => setTypeFilter(type.id)}
                >
                  {type.label}
                </ChipFilterButton>
              ))}
            </ChipFilterBar>

            {sourceOptions.length > 1 && (
              <div className="bookmarks-controls__sources" role="group" aria-label={t("favorites.bySource")}>
                <button type="button" className={sourceFilter === "all" ? "active" : ""} onClick={() => setSourceFilter("all")}>
                  <Globe2 size={13} aria-hidden="true" />
                  <span>{t("common.all")}</span>
                </button>
                {sourceOptions.map(([id]) => (
                  <button key={id} type="button" className={sourceFilter === id ? "active" : ""} onClick={() => setSourceFilter(id)}>
                    <SourceLogo sourceId={id} />
                    <span>{getSourceProfile(id).name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="bookmarks-controls__footer">
              <span>{t("favorites.nTitles", { count: visibleItems.length })}</span>
              <div className="bookmarks-controls__actions">
                {hasActiveFilters && (
                  <button type="button" className="bookmarks-controls__reset" onClick={resetFilters}>
                    {t("common.clearFilter")}
                  </button>
                )}
                <button
                  type="button"
                  className="bookmarks-controls__sort"
                  onClick={() => setSortMode((mode) => (mode === "saved" ? "title" : "saved"))}
                  aria-label={t("favorites.sortAria")}
                >
                  <ArrowDownAZ size={14} aria-hidden="true" />
                  <span>{sortMode === "saved" ? t("favorites.newest") : t("favorites.alpha")}</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {totalItems ? (
          visibleItems.length ? (
            <>
            <div className="bookmark-list" ref={listHeadRef}>
              {pagedVisibleItems.map((entry) => {
                const item = entry.item;
                const latestChapter = entry.kind === "live" ? item.recentChapters?.[0] : null;
                const subtitle = item.altTitle || item.subtitle;
                const progress = entry.kind === "demo" ? item.progress : null;
                const { typeLabel, readingLine, continueLabel, isVideo } = getBookmarkRowCopy(entry, latestChapter, t);
                const ContinueIcon = isVideo ? Clapperboard : BookOpen;
                return (
                  <article
                    className={`bookmark-row bookmark-row--${entry.type}${latestChapter?.url ? " bookmark-row--continue" : ""}`}
                    key={entry.key}
                  >
                    <button
                      className="bookmark-row__open"
                      type="button"
                      onClick={() => (entry.kind === "demo" ? openManga(item) : openLiveManga(item))}
                    >
                      <span className={`bookmark-row__media bookmark-row__media--${entry.type}${isVideo ? " bookmark-row__media--video" : ""}`}>
                        {entry.kind === "demo" ? (
                          <Cover item={item} />
                        ) : (
                          <RemoteCover
                            src={item.cover}
                            title={item.title}
                            sourceId={entry.sourceId || item.sourceId}
                            video={isVideo}
                          />
                        )}
                        <span className={`bookmark-row__type bookmark-row__type--${entry.type}`}>
                          {typeLabel}
                        </span>
                      </span>
                      <span className="bookmark-row__body">
                        <strong dir="auto">{item.title}</strong>
                        {subtitle && <span className="bookmark-row__subtitle" dir="auto">{subtitle}</span>}
                        <span className="bookmark-row__source">
                          <SourceLogo sourceId={entry.sourceId} />
                          <span>{entry.sourceName}</span>
                        </span>
                        <span className="bookmark-row__reading">
                          {entry.kind === "demo" ? (
                            <>
                              <em>{readingLine}</em>
                              <b>{item.progress}%</b>
                            </>
                          ) : (
                            <em>{readingLine}</em>
                          )}
                        </span>
                        {progress != null && (
                          <span className="bookmark-row__progress" aria-hidden="true">
                            <span className="progress progress--thin">
                              <span style={{ width: `${progress}%` }} />
                            </span>
                          </span>
                        )}
                      </span>
                      <ChevronLeft className="bookmark-row__chevron" size={18} aria-hidden="true" />
                    </button>
                    <div className="bookmark-row__aside">
                      <button
                        className="bookmark-row__remove"
                        type="button"
                        onClick={() => (entry.kind === "demo" ? toggleFavorite(item.id) : toggleLiveFavorite(item))}
                        aria-label={`${t("favorites.remove")}: ${item.title}`}
                        title={t("favorites.remove")}
                      >
                        <Bookmark size={15} fill="currentColor" aria-hidden="true" />
                      </button>
                      {continueLabel && (
                        <button
                          type="button"
                          className="bookmark-row__continue"
                          onClick={() => openLiveChapter(item, latestChapter)}
                        >
                          <ContinueIcon size={13} aria-hidden="true" />
                          <span>{continueLabel}</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <SearchResultsPagination
              page={listPage}
              totalPages={totalListPages}
              totalItems={visibleItems.length}
              pageSize={listPageSize}
              onPageChange={goToListPage}
              ariaLabel={t("favorites.pagesAria")}
            />
            </>
          ) : (
            <EmptyState
              icon={Search}
              variant="accent"
              title={t("favorites.noMatch")}
              description={t("favorites.changeSearch")}
              actionLabel={t("common.clearFilter")}
              onAction={resetFilters}
            />
          )
        ) : (
          <EmptyState
            icon={Bookmark}
            variant="accent"
            title={t("favorites.empty")}
            description={isChromebookApp ? t("favorites.emptyHintVideo") : t("favorites.emptyHint")}
            actionLabel={t("favorites.startDiscover")}
            onAction={() => navigate("sources")}
          />
        )}
      </main>
    </div>
  );
}

export function UpdatesScreen({
  chapterFollow,
  openLiveReader,
  openLiveManga,
  navigate,
}) {
  const { pushToast } = useToast();
  const { t, locale } = useI18n();
  const { feed, preferences, syncing, lastSyncAt, syncFollowed, markFeedRead } = chapterFollow;
  const [filter, setFilter] = useState("all");

  const followedItems = useMemo(
    () => Object.values(preferences || {})
      .filter((entry) => entry?.enabled !== false && entry?.url)
      .filter((entry) => isVisibleUpdateType(resolveFollowMediaType(entry)))
      .sort((a, b) => (a.title || "").localeCompare(b.title || "", locale)),
    [locale, preferences],
  );

  const scopedFeed = useMemo(
    () => feed.filter((entry) => isVisibleUpdateType(resolveUpdateMediaType(entry))),
    [feed],
  );

  const unreadCount = useMemo(
    () => scopedFeed.filter((entry) => !entry.read).length,
    [scopedFeed],
  );

  const followedCount = followedItems.length;

  const previewFollowedItems = followedItems;

  const visibleFeed = useMemo(
    () => (filter === "unread" ? scopedFeed.filter((entry) => !entry.read) : scopedFeed),
    [filter, scopedFeed],
  );

  const groupedFeed = useMemo(() => {
    const order = ["today", "yesterday", "week", "older"];
    return order
      .map((id) => ({
        id,
        label: historyDayGroupLabel(id),
        items: visibleFeed.filter((entry) => getHistoryDayGroup(entry.announcedAt) === id),
      }))
      .filter((group) => group.items.length > 0);
  }, [locale, visibleFeed]);

  async function handleRefresh() {
    const result = await syncFollowed({ silent: false });
    if (result.skipped) return;
    if (result.errors?.length) {
      pushToast({ type: "error", message: t("toast.checkSomeFailed") });
      return;
    }
    if (result.events?.length) {
      pushToast({ type: "success", message: t("updates.nNew", { count: result.events.length }) });
      return;
    }
    pushToast({ type: "info", message: t("updates.noneNew") });
  }

  function openUpdate(entry) {
    markFeedRead(entry.id);
    const manga = {
      url: entry.url,
      title: entry.title,
      altTitle: entry.altTitle,
      cover: entry.cover,
      sourceId: entry.sourceId,
      mediaType: entry.mediaType,
    };
    const chapter = {
      url: entry.chapterUrl,
      number: entry.chapterNumber,
      name: entry.chapterName,
    };
    openLiveReader(manga, chapter);
  }

  return (
    <div className={`screen${isChromebookApp ? " screen--updates-desktop" : ""}`}>
      {isChromebookApp ? (
        <header className="settings-desktop-head">
          <span className="eyebrow">{t("updates.eyebrow")}</span>
          <h1>{t("updates.title")}</h1>
        </header>
      ) : (
        <Header title={t("updates.title")} eyebrow={t("updates.eyebrow")} onSearch={() => navigate("search")} onReadingHistory={() => navigate("reading-history")} onNotifications={() => navigate("updates")} />
      )}
      <main className="content updates-page">
        <section className={`updates-hero${unreadCount ? " updates-hero--unread" : ""}`}>
          <div className="updates-hero__main">
            <span className="updates-hero__icon" aria-hidden="true">
              <Sparkles size={15} />
              {unreadCount > 0 && <em aria-label={`${unreadCount} ${t("updates.unread")}`}>{unreadCount}</em>}
            </span>
            <div className="updates-hero__copy">
              <strong>{unreadCount ? t("updates.nNew", { count: unreadCount }) : t("updates.noneNew")}</strong>
              <span>
                {followedCount
                  ? t("updates.nFollowed", { count: followedCount })
                  : (isChromebookApp ? t("updates.followHintSeries") : t("updates.followHint"))}
                {lastSyncAt ? ` · ${formatRelativeReadingTime(lastSyncAt)}` : ""}
              </span>
            </div>
            <button
              type="button"
              className={`updates-hero__refresh${syncing ? " is-syncing" : ""}`}
              onClick={handleRefresh}
              disabled={syncing || !followedCount}
              aria-label={t("updates.refresh")}
            >
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="updates-hero__footer">
            <button
              type="button"
              className="updates-hero__link"
              onClick={() => navigate("notification-center")}
            >
              <Settings2 size={13} />
              <span>{t("updates.followCenter")}{followedCount ? ` · ${followedCount}` : ""}</span>
            </button>
            {followedCount > 0 && (
              <span className="updates-hero__sync">
                <Clock3 size={12} />
                {t("updates.autoCheck")}
              </span>
            )}
          </div>

          {followedCount > 0 && (
            <div className="updates-hero__stats">
              <span><Bell size={12} />{unreadCount} {t("updates.unread")}</span>
              <span>
                {isChromebookApp ? <Clapperboard size={12} /> : <BookOpen size={12} />}
                {scopedFeed.length} {t("updates.inList")}
              </span>
            </div>
          )}
        </section>

        {(scopedFeed.length > 0 || followedCount > 0) && (
          <div className="updates-toolbar">
            {scopedFeed.length > 0 && (
              <>
            <ChipFilterBar
              variant="segmented"
              className="updates-toolbar__filter"
              role="tablist"
              ariaLabel={t("updates.filterAria")}
            >
              <ChipFilterButton
                role="tab"
                active={filter === "all"}
                count={scopedFeed.length}
                onClick={() => setFilter("all")}
              >
                {t("common.all")}
              </ChipFilterButton>
              <ChipFilterButton
                role="tab"
                active={filter === "unread"}
                count={unreadCount}
                disabled={!unreadCount}
                onClick={() => setFilter("unread")}
              >
                {t("updates.unread")}
              </ChipFilterButton>
            </ChipFilterBar>
            <button
              type="button"
              className="updates-toolbar__mark"
              disabled={!unreadCount}
              onClick={() => {
                scopedFeed.filter((entry) => !entry.read).forEach((entry) => markFeedRead(entry.id));
                pushToast({ type: "success", message: t("toast.markedAllRead") });
              }}
            >
              <CheckCheck size={14} />
              {t("updates.allRead")}
            </button>
              </>
            )}
          </div>
        )}

        {groupedFeed.length > 0 ? (
          <div className="updates-feed">
            {groupedFeed.map((group) => (
              <section key={group.id} className="updates-group">
                <h3 className="updates-group__title">{group.label}</h3>
                <div className="updates-list">
                  {group.items.map((entry) => {
                    const mediaType = resolveUpdateMediaType(entry);
                    const mediaLabel = contentTypes[mediaType]?.singular || t("content.mangaSingular");
                    return (
                      <button
                        type="button"
                        className={`update-card${entry.read ? "" : " update-card--unread"}`}
                        key={entry.id}
                        onClick={() => openUpdate(entry)}
                      >
                        <div className="update-card__cover">
                          <UpdatesRemoteCover
                            src={entry.cover}
                            title={entry.title}
                            sourceId={entry.sourceId}
                            video={isVideoMediaType(mediaType)}
                          />
                          {!entry.read && <span className="update-card__badge">{t("common.new")}</span>}
                        </div>
                        <span className="update-card__body">
                          <span className="update-card__meta">
                            <SourceLogo sourceId={entry.sourceId} className="update-card__source" />
                            <small>{formatRelativeReadingTime(entry.announcedAt)}</small>
                            <em>{mediaLabel}</em>
                          </span>
                          <strong dir="auto">{entry.title}</strong>
                          <span>{formatFollowUpdateLine(entry)}</span>
                        </span>
                        <ChevronLeft size={15} className="update-card__chevron" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : scopedFeed.length > 0 && filter === "unread" ? (
          <EmptyState
            className="updates-empty"
            icon={CheckCheck}
            title={t("updates.noUnread")}
            description={t("updates.allCurrentRead")}
            actionLabel={t("updates.showAll")}
            onAction={() => setFilter("all")}
          />
        ) : followedCount > 0 ? (
          <>
            <UpdatesFollowedPreview
              items={previewFollowedItems}
              onOpen={openLiveManga}
              onManage={() => navigate("notification-center")}
            />
            <EmptyState
              className="updates-empty updates-empty--compact"
              icon={Sparkles}
              title={t("updates.empty")}
              description={isChromebookApp ? t("updates.emptyHintSeries") : t("updates.emptyHint")}
              actionLabel={t("updates.refreshNow")}
              onAction={handleRefresh}
            />
          </>
        ) : (
          <UpdatesEmptyPanel
            variant={isChromebookApp ? "series" : "default"}
            onDiscover={() => navigate("sources")}
            onSettings={() => navigate("notification-center")}
          />
        )}
      </main>
    </div>
  );
}

const SEARCH_TYPE_ORDER = VISIBLE_MEDIA_TYPES;
const SEARCH_SUGGESTIONS = ["you", "reacher", "lupin", "dark", "stranger"];

const SEARCH_DESKTOP_PAGE_SIZE = 18;

export function SearchScreen({ sources, sourcePreferences, openLiveManga, navigate }) {
  const { pushToast } = useToast();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState("all");
  const [audioFilter, setAudioFilter] = useState("all");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchErrors, setSearchErrors] = useState([]);
  const [resultsPage, setResultsPage] = useState(1);
  const resultsHeadRef = useRef(null);
  const lastToastQueryRef = useRef("");
  const enabledSources = useMemo(() => getEnabledSources(sources), [sources]);
  const scopedSources = useMemo(
    () => enabledSources.filter((source) => sourceSupportsMediaType(source.id, mediaType)),
    [enabledSources, mediaType],
  );
  const typeFilters = useMemo(() => {
    const supported = new Set();
    enabledSources.forEach((source) => {
      (getSourceProfile(source.id).contentTypes || []).forEach((type) => supported.add(type));
    });
    return [
      { id: "all", label: contentTypes.all.label },
      ...SEARCH_TYPE_ORDER.filter((id) => supported.has(id)).map((id) => ({ id, label: contentTypes[id].label })),
    ];
  }, [enabledSources]);
  const normalizedQuery = query.trim();
  const groupResultsBySource = scopedSources.length > 1;
  const searchPageSize = isChromebookApp ? SEARCH_DESKTOP_PAGE_SIZE : SEARCH_RESULTS_PAGE_SIZE;
  const totalResultsPages = Math.max(1, Math.ceil(results.length / searchPageSize));
  const pagedResults = useMemo(
    () => results.slice((resultsPage - 1) * searchPageSize, resultsPage * searchPageSize),
    [results, resultsPage, searchPageSize],
  );

  useEffect(() => {
    setResultsPage(1);
    lastToastQueryRef.current = "";
  }, [mediaType, audioFilter, normalizedQuery]);

  useEffect(() => {
    if (resultsPage > totalResultsPages) setResultsPage(totalResultsPages);
  }, [resultsPage, totalResultsPages]);

  const goToResultsPage = (page) => {
    setResultsPage(page);
    resultsHeadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setResults([]);
      setSearchErrors([]);
      setLoading(false);
      return undefined;
    }
    if (!enabledSources.length) {
      setResults([]);
      setSearchErrors([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      searchEnabledSources({ sources, sourcePreferences, query: normalizedQuery, mediaType })
        .then((batches) => {
          setResults(filterItemsByAudioLanguage(flattenSearchBatches(batches, normalizedQuery), audioFilter));
          setSearchErrors(batches.filter((batch) => batch.error).map((batch) => ({
            sourceId: batch.sourceId,
            sourceName: batch.sourceName,
            message: batch.error,
          })));
        })
        .catch(() => {
          setResults([]);
          setSearchErrors([]);
        })
        .finally(() => setLoading(false));
    }, 220);

    return () => clearTimeout(timer);
  }, [audioFilter, enabledSources.length, mediaType, normalizedQuery, sourcePreferences, sources]);

  useEffect(() => {
    if (loading || normalizedQuery.length < 2) return;
    if (lastToastQueryRef.current === `${normalizedQuery}:${mediaType}`) return;
    lastToastQueryRef.current = `${normalizedQuery}:${mediaType}`;
    if (searchErrors.length && !results.length) {
      pushToast({ type: "error", message: t("toast.searchFailed") });
      return;
    }
    if (results.length) {
      pushToast({ type: "success", message: t("toast.nResultsFound", { count: results.length }) });
      return;
    }
    pushToast({ type: "info", message: t("search.empty") });
  }, [loading, mediaType, normalizedQuery, pushToast, results.length, searchErrors.length, t]);

  return (
    <div className={`screen${isChromebookApp ? " screen--search-desktop" : ""}`}>
      {isChromebookApp ? (
        <header className="settings-desktop-head">
          <span className="eyebrow">{t("search.eyebrowVideo")}</span>
          <h1>{t("search.title")}</h1>
        </header>
      ) : (
        <Header title={t("search.title")} eyebrow={t("search.eyebrow")} onBack={() => navigate("home")} actions={false} />
      )}
      <main className="content search-page">
        <section className="search-hero">
          <AccessibleSearchField
            className="global-search search-hero__field"
            value={query}
            onChange={setQuery}
            placeholder={isChromebookApp ? t("search.placeholderVideo") : t("search.placeholder")}
            ariaLabel={t("search.aria")}
            autoFocus={!isChromebookApp}
          />
          {typeFilters.length > 1 && (
            <ChipFilterBar
              className="search-hero__types"
              variant="segmented"
              role="tablist"
              ariaLabel={t("favorites.contentType")}
              label={t("search.type")}
            >
              {typeFilters.map((filter) => (
                <ChipFilterButton
                  key={filter.id}
                  role="tab"
                  active={mediaType === filter.id}
                  onClick={() => setMediaType(filter.id)}
                >
                  {filter.label}
                </ChipFilterButton>
              ))}
            </ChipFilterBar>
          )}
          {isChromebookApp && (
            <ChipFilterBar
              className="search-hero__types"
              variant="segmented"
              role="group"
              ariaLabel={t("sources.audioFilter")}
              label={t("sources.audioFilter")}
            >
              <ChipFilterButton active={audioFilter === "all"} onClick={() => setAudioFilter("all")}>
                {t("common.all")}
              </ChipFilterButton>
              <ChipFilterButton active={audioFilter === "VF"} onClick={() => setAudioFilter("VF")}>
                VF
              </ChipFilterButton>
              <ChipFilterButton active={audioFilter === "VOSTFR"} onClick={() => setAudioFilter("VOSTFR")}>
                VOSTFR
              </ChipFilterButton>
            </ChipFilterBar>
          )}
          {enabledSources.length > 0 && (
            <SearchScopeFooter
              enabledSources={enabledSources}
              sourcePreferences={sourcePreferences}
              onManage={() => navigate("source-management")}
            />
          )}
        </section>

        {!normalizedQuery && (
          <>
            {!enabledSources.length && (
              <EmptyState
                icon={Search}
                variant="brand"
                title={t("search.noEnabled")}
                description={t("search.enableOne")}
                actionLabel={t("search.manage")}
                onAction={() => navigate("source-management")}
              />
            )}
            <SectionTitle title={t("search.popular")} />
            <div className="search-chips">
              {SEARCH_SUGGESTIONS.map((term) => (
                <button key={term} type="button" onClick={() => setQuery(term)}>{term}</button>
              ))}
            </div>
            <section className="search-hint">
              <Search size={27} />
              <h2>{t("search.onePlace")}</h2>
              <p>{isChromebookApp ? t("search.typeTwoVideo") : t("search.typeTwo")}</p>
            </section>
          </>
        )}

        {normalizedQuery.length >= 2 && (
          <>
            <div className="search-results-head" ref={resultsHeadRef}>
              <div className="search-results-head__copy">
                <h2>{t("search.results")}</h2>
                <p>{t("search.about", { query: normalizedQuery })}{mediaType !== "all" ? ` · ${contentTypes[mediaType]?.label}` : ""}{audioFilter !== "all" ? ` · ${audioFilter}` : ""}</p>
              </div>
              <span className="search-results-head__badge">
                {loading ? t("common.loading") : t("search.nResults", { count: results.length })}
              </span>
            </div>

            {searchErrors.length > 0 && (
              <div className="search-results-alert" role="status">
                {searchErrors.map((entry) => (
                  <span key={entry.sourceId}>
                    {t("search.failedIn", { source: entry.sourceName })}
                  </span>
                ))}
              </div>
            )}

            {loading ? (
              <SearchResultsSkeleton count={Math.min(5, Math.max(3, scopedSources.length || enabledSources.length))} />
            ) : results.length ? (
              <>
                <SearchResultsList
                  key={`${normalizedQuery}:${mediaType}`}
                  results={pagedResults}
                  onOpen={openLiveManga}
                  groupBySource={groupResultsBySource}
                />
                <SearchResultsPagination
                  page={resultsPage}
                  totalPages={totalResultsPages}
                  totalItems={results.length}
                  pageSize={searchPageSize}
                  onPageChange={goToResultsPage}
                />
              </>
            ) : enabledSources.length ? (
              <EmptyState
                icon={Search}
                variant="brand"
                title={t("search.empty")}
                description={mediaType === "all" ? t("search.tryOther") : t("search.emptyType")}
              />
            ) : (
              <EmptyState
                icon={Search}
                variant="brand"
                title={t("search.noEnabled")}
                description={t("search.enableFromManage")}
                actionLabel={t("search.manage")}
                onAction={() => navigate("source-management")}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
