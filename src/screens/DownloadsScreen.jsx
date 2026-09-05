import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  Clapperboard,
  Download,
  HardDrive,
  LoaderCircle,
  PauseCircle,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Header } from "../components/layout/Header";
import { ChipFilterBar, ChipFilterButton } from "../components/ui/ChipFilterBar";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { AccessibleSearchField } from "../components/ui/AccessibleSearchField";
import { useToast } from "../components/ui/ToastProvider";
import { usePersistedState } from "../hooks/usePersistedState";
import { isChromebookApp, VISIBLE_MEDIA_TYPES } from "../config/appFlavor";
import { getSourceProfile } from "../config/sources";
import { RemoteCover, SearchResultsPagination, SourceLogo, COLLECTION_DESKTOP_PAGE_SIZE, COLLECTION_PAGE_SIZE } from "../features/sources";
import { isVideoMediaType } from "../features/sources/mediaPresentation";
import { useI18n } from "../i18n/I18nProvider";
import {
  buildLiveItemFromDownload,
  clearDownloads,
  DOWNLOADS_STORAGE_KEY,
  EMPTY_DOWNLOADS,
  filterDownloads,
  getDownloadStats,
  listDownloads,
  normalizeDownloads,
  removeDownloadItem,
  resolveOpenChapter,
} from "../lib/downloads/downloadsModel";
import { formatBytes } from "../lib/downloads/formatBytes";
import { loadOfflinePrefetch, removeNovelDownload } from "../lib/downloads/novelDownloadService.js";

const STATUS_ICONS = {
  complete: CheckCircle2,
  downloading: LoaderCircle,
  queued: LoaderCircle,
  failed: TriangleAlert,
  paused: PauseCircle,
};

function isVisibleDownloadType(mediaType) {
  if (!isChromebookApp) return true;
  return VISIBLE_MEDIA_TYPES.includes(mediaType);
}

function DownloadStatusIcon({ status }) {
  const Icon = STATUS_ICONS[status] || Download;
  const spinning = status === "downloading" || status === "queued";
  return <Icon size={14} aria-hidden="true" className={spinning ? "downloads-row__status-icon--spin" : ""} />;
}

function DownloadRow({ item, onOpen, onDelete, t, locale }) {
  const profile = getSourceProfile(item.sourceId);
  const progress = item.totalBytes > 0
    ? Math.round((item.downloadedBytes / item.totalBytes) * 100)
    : Math.round(
      item.chapters.reduce((sum, chapter) => sum + chapter.progress, 0)
      / Math.max(1, item.chapters.length),
    );
  const completeChapters = item.chapters.filter((chapter) => chapter.status === "complete").length;
  const canOpen = item.status === "complete" || completeChapters > 0;

  return (
    <article className={`downloads-row downloads-row--${item.status}`}>
      <button
        type="button"
        className="downloads-row__main"
        onClick={() => { if (canOpen) onOpen(item); }}
        disabled={!canOpen}
      >
        <RemoteCover
          src={item.cover}
          title={item.title}
          sourceId={item.sourceId}
          className="downloads-row__cover"
          video={isVideoMediaType(item.mediaType)}
          novel={item.mediaType === "novel"}
        />
        <span className="downloads-row__copy">
          <span className="downloads-row__meta">
            <SourceLogo sourceId={item.sourceId} className="downloads-row__source" />
            <small>{profile.name}</small>
            <em>{t(`media.${item.mediaType}`) || item.mediaType}</em>
          </span>
          <strong dir="auto">{item.title}</strong>
          <span className="downloads-row__details">
            <DownloadStatusIcon status={item.status} />
            <span>{t(`downloads.status.${item.status}`)}</span>
            <span aria-hidden="true">·</span>
            <span>{t("downloads.chaptersProgress", { done: completeChapters, total: item.chapters.length })}</span>
            {item.downloadedBytes > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatBytes(item.downloadedBytes, locale)}</span>
              </>
            ) : null}
          </span>
          <span className="downloads-row__progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <span className="downloads-row__progress-bar" style={{ width: `${progress}%` }} />
          </span>
        </span>
        {canOpen ? <ChevronLeft size={16} aria-hidden="true" /> : null}
      </button>
      <button
        type="button"
        className="downloads-row__delete"
        onClick={() => onDelete(item)}
        aria-label={t("downloads.remove", { title: item.title })}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </article>
  );
}

export function DownloadsScreen({
  navigate,
  onBack,
  openLiveManga,
  openLiveReader,
}) {
  const { t, locale, dir } = useI18n();
  const { pushToast } = useToast();
  const [rawDownloads, setRawDownloads] = usePersistedState(DOWNLOADS_STORAGE_KEY, EMPTY_DOWNLOADS);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [listPage, setListPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState(null);
  const listHeadRef = useRef(null);

  const items = useMemo(() => listDownloads(rawDownloads), [rawDownloads]);
  const scopedItems = useMemo(
    () => items.filter((item) => isVisibleDownloadType(item.mediaType)),
    [items],
  );
  const stats = useMemo(() => getDownloadStats(scopedItems), [scopedItems]);
  const visibleItems = useMemo(
    () => filterDownloads(scopedItems, { query, status: statusFilter, mediaType: typeFilter }),
    [query, scopedItems, statusFilter, typeFilter],
  );

  const listPageSize = isChromebookApp ? COLLECTION_DESKTOP_PAGE_SIZE : COLLECTION_PAGE_SIZE;
  const totalListPages = Math.max(1, Math.ceil(visibleItems.length / listPageSize));
  const pagedItems = useMemo(
    () => visibleItems.slice((listPage - 1) * listPageSize, listPage * listPageSize),
    [listPage, listPageSize, visibleItems],
  );

  useEffect(() => {
    setListPage(1);
  }, [query, statusFilter, typeFilter]);

  useEffect(() => {
    if (listPage > totalListPages) setListPage(totalListPages);
  }, [listPage, totalListPages]);

  const hasActiveFilters = Boolean(query || statusFilter !== "all" || typeFilter !== "all");

  const statusFilters = [
    { id: "all", label: t("common.all"), count: stats.total },
    { id: "downloading", label: t("downloads.status.downloading"), count: stats.active },
    { id: "complete", label: t("downloads.status.complete"), count: stats.complete },
    { id: "failed", label: t("downloads.status.failed"), count: stats.failed },
  ];

  const typeFilters = useMemo(() => {
    const all = { id: "all", label: t("content.all"), count: stats.total };
    if (isChromebookApp) {
      return [
        all,
        { id: "movie", label: t("content.movie"), count: scopedItems.filter((item) => item.mediaType === "movie").length },
        { id: "series", label: t("content.series"), count: scopedItems.filter((item) => item.mediaType === "series").length },
      ];
    }
    return [
      all,
      { id: "manga", label: t("content.manga"), count: scopedItems.filter((item) => item.mediaType === "manga").length },
      { id: "novel", label: t("content.novel"), count: scopedItems.filter((item) => item.mediaType === "novel").length },
      { id: "anime", label: t("content.anime"), count: scopedItems.filter((item) => item.mediaType === "anime").length },
      { id: "movie", label: t("content.movie"), count: scopedItems.filter((item) => item.mediaType === "movie").length },
    ];
  }, [scopedItems, stats.total, t]);

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    pushToast({ type: "success", message: t("toast.filterCleared") });
  }

  async function handleOpen(item) {
    const chapter = resolveOpenChapter(item);
    const liveItem = buildLiveItemFromDownload(item);
    if (chapter?.url) {
      const prefetchData = item.mediaType === "novel"
        ? await loadOfflinePrefetch(liveItem, chapter)
        : null;
      openLiveReader(liveItem, {
        url: chapter.url,
        number: chapter.number,
        name: chapter.name,
      }, prefetchData ? { prefetchData } : {});
      return;
    }
    openLiveManga(liveItem);
  }

  function requestDelete(item) {
    setConfirmAction({ type: "remove", id: item.id, title: item.title });
  }

  function requestClearAll() {
    setConfirmAction({ type: "clear" });
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;
    if (confirmAction.type === "remove") {
      const item = scopedItems.find((entry) => entry.id === confirmAction.id);
      if (item?.mediaType === "novel") {
        await removeNovelDownload(item);
      }
      setRawDownloads((current) => removeDownloadItem(current, confirmAction.id));
      pushToast({ type: "success", message: t("downloads.removed") });
    }
    if (confirmAction.type === "clear") {
      for (const item of scopedItems.filter((entry) => entry.mediaType === "novel")) {
        await removeNovelDownload(item);
      }
      setRawDownloads(clearDownloads(normalizeDownloads(rawDownloads)));
      pushToast({ type: "success", message: t("downloads.cleared") });
    }
    setConfirmAction(null);
  }

  const goToListPage = (page) => {
    setListPage(page);
    listHeadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={`screen screen--downloads${isChromebookApp ? " screen--downloads-desktop" : ""}`} dir={dir}>
      {isChromebookApp ? (
        <header className="settings-desktop-head">
          <span className="eyebrow">{t("downloads.eyebrow")}</span>
          <h1>{t("downloads.title")}</h1>
        </header>
      ) : (
        <Header
          title={t("downloads.title")}
          eyebrow={stats.total ? t("downloads.savedCount", { count: stats.total }) : t("downloads.eyebrow")}
          onBack={onBack || (() => navigate("settings"))}
          actions={false}
        />
      )}
      <main className="content downloads-page">
        <section className="downloads-hero" aria-label={t("downloads.summary")}>
          <div className="downloads-hero__glow" aria-hidden="true" />
          <div className="downloads-hero__icon" aria-hidden="true">
            <Download size={20} />
          </div>
          <div className="downloads-hero__copy">
            <h2>
              {stats.active
                ? t("downloads.activeCount", { count: stats.active })
                : t("downloads.offlineReady")}
            </h2>
            <p>
              {stats.total
                ? t("downloads.storageSummary", {
                  size: formatBytes(stats.storageBytes, locale),
                  chapters: stats.chapters,
                })
                : t("downloads.emptyHint")}
            </p>
          </div>
          <div className="downloads-hero__stats">
            <span>
              <HardDrive size={13} aria-hidden="true" />
              <strong>{formatBytes(stats.storageBytes, locale)}</strong>
              <small>{t("downloads.storage")}</small>
            </span>
            <span>
              <CheckCircle2 size={13} aria-hidden="true" />
              <strong>{stats.complete}</strong>
              <small>{t("downloads.status.complete")}</small>
            </span>
            <span>
              {isChromebookApp ? <Clapperboard size={13} aria-hidden="true" /> : <Download size={13} aria-hidden="true" />}
              <strong>{stats.chapters}</strong>
              <small>{t("downloads.chapters")}</small>
            </span>
          </div>
        </section>

        <div className="downloads-controls" ref={listHeadRef}>
          <AccessibleSearchField
            className="global-search downloads-controls__search"
            value={query}
            onChange={setQuery}
            placeholder={t("downloads.searchPlaceholder")}
            ariaLabel={t("downloads.searchAria")}
          />
          <ChipFilterBar variant="segmented" className="downloads-controls__status" role="group" ariaLabel={t("downloads.filterAria")}>
            {statusFilters.map((filter) => (
              <ChipFilterButton
                key={filter.id}
                active={statusFilter === filter.id}
                onClick={() => setStatusFilter(filter.id)}
              >
                {filter.label}
                {filter.id !== "all" && filter.count > 0 ? ` (${filter.count})` : ""}
              </ChipFilterButton>
            ))}
          </ChipFilterBar>
          {typeFilters.length > 2 ? (
            <ChipFilterBar variant="segmented" className="downloads-controls__types" role="group" ariaLabel={t("downloads.typeFilterAria")}>
              {typeFilters.map((filter) => (
                <ChipFilterButton
                  key={filter.id}
                  active={typeFilter === filter.id}
                  onClick={() => setTypeFilter(filter.id)}
                >
                  {filter.label}
                </ChipFilterButton>
              ))}
            </ChipFilterBar>
          ) : null}
          {hasActiveFilters ? (
            <button type="button" className="downloads-controls__reset" onClick={resetFilters}>
              {t("common.clearFilter")}
            </button>
          ) : null}
        </div>

        {pagedItems.length ? (
          <div className="downloads-list">
            {pagedItems.map((item) => (
              <DownloadRow
                key={item.id}
                item={item}
                t={t}
                locale={locale}
                onOpen={handleOpen}
                onDelete={requestDelete}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Download}
            title={hasActiveFilters ? t("downloads.emptyFilter") : t("downloads.empty")}
            description={hasActiveFilters ? t("downloads.changeSearch") : t("downloads.emptyDescription")}
            actionLabel={hasActiveFilters ? t("common.clearFilter") : t("downloads.discover")}
            onAction={hasActiveFilters ? resetFilters : () => navigate("sources")}
          />
        )}

        {visibleItems.length > listPageSize ? (
          <SearchResultsPagination
            page={listPage}
            totalPages={totalListPages}
            onPageChange={goToListPage}
            ariaLabel={t("downloads.pagesAria")}
          />
        ) : null}

        {scopedItems.length > 0 ? (
          <div className="downloads-footer">
            <button type="button" className="downloads-footer__clear" onClick={requestClearAll}>
              <Trash2 size={16} aria-hidden="true" />
              <span>{t("downloads.clearAll")}</span>
            </button>
          </div>
        ) : null}
      </main>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.type === "clear" ? t("downloads.clearAllTitle") : t("downloads.removeTitle")}
        message={confirmAction?.type === "clear"
          ? t("downloads.clearAllBody")
          : t("downloads.removeBody", { title: confirmAction?.title || "" })}
        confirmLabel={confirmAction?.type === "clear" ? t("downloads.clearAll") : t("common.delete")}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
