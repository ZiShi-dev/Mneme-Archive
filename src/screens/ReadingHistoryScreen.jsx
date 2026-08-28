import React, { useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronLeft,
  Clock3,
  History,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useToast } from "../components/ui/ToastProvider";
import { Header } from "../components/layout/Header";
import { Cover } from "../components/manga/Cover";
import { ChipFilterBar, ChipFilterButton } from "../components/ui/ChipFilterBar";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { AccessibleSearchField } from "../components/ui/AccessibleSearchField";
import { manga as demoCatalog } from "../data/demoManga";
import { getSourceProfile } from "../config/sources";
import { resolveBookmarkType } from "../features/sources/contentTypes";
import { RemoteCover, SourceLogo } from "../features/sources";
import { listTitleChapterReads } from "../lib/reading/chapterReadLog";
import { ReadingChapterLogButton, ReadingChapterLogSheet } from "./ReadingChapterLogSheet";
import { useI18n } from "../i18n/I18nProvider";
import {
  formatHistoryUnitLabel,
  formatRelativeReadingTime,
  getRecordProgress,
  groupHistoryEntries,
  isReadToday,
  isRecordCompleted,
  listReadingHistory,
  normalizeReadingRecord,
  resolveHistoryTarget,
} from "../lib/readingProgress";

const CONTENT_SINGULAR_KEYS = {
  manga: "content.mangaSingular",
  novel: "content.novelSingular",
  anime: "content.animeSingular",
  movie: "content.movieSingular",
  series: "content.seriesSingular",
};

export function ReadingHistoryScreen({
  readingHistory,
  chapterReadLog = {},
  liveFavorites,
  navigate,
  onBack,
  openManga,
  openLiveManga,
  openReader,
  openLiveReader,
  onRemoveEntry,
  onClearHistory,
}) {
  const { t } = useI18n();
  const { pushToast } = useToast();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmAction, setConfirmAction] = useState(null);
  const [chapterLogEntry, setChapterLogEntry] = useState(null);

  const entries = useMemo(
    () => listReadingHistory(readingHistory).map((entry) => ({
      ...entry,
      record: normalizeReadingRecord(entry.record),
    })),
    [readingHistory],
  );

  const enrichedEntries = useMemo(() => entries.map((entry) => {
    const type = resolveBookmarkType(entry.record);
    const target = resolveHistoryTarget(entry.record, { demoCatalog, liveFavorites });
    return { ...entry, type, target };
  }), [entries, liveFavorites]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleEntries = useMemo(() => enrichedEntries
    .filter((entry) => typeFilter === "all" || entry.type === typeFilter)
    .filter((entry) => {
      if (statusFilter === "reading") return !isRecordCompleted(entry.record);
      if (statusFilter === "done") return isRecordCompleted(entry.record);
      if (statusFilter === "today") return isReadToday(entry.record);
      return true;
    })
    .filter((entry) => {
      if (!normalizedQuery) return true;
      const haystack = `${entry.record.title} ${entry.record.altTitle || ""} ${getSourceProfile(entry.record.sourceId).name}`;
      return haystack.toLowerCase().includes(normalizedQuery);
    }), [enrichedEntries, normalizedQuery, statusFilter, typeFilter]);

  const timeline = useMemo(() => groupHistoryEntries(visibleEntries), [visibleEntries]);

  const stats = useMemo(() => ({
    total: entries.length,
    reading: entries.filter(({ record }) => !isRecordCompleted(record)).length,
    doneToday: entries.filter(({ record }) => isReadToday(record)).length,
    manga: enrichedEntries.filter((entry) => entry.type === "manga").length,
    novel: enrichedEntries.filter((entry) => entry.type === "novel").length,
    anime: enrichedEntries.filter((entry) => entry.type === "anime").length,
    movie: enrichedEntries.filter((entry) => entry.type === "movie").length,
  }), [entries, enrichedEntries]);

  const hasActiveFilters = Boolean(query || typeFilter !== "all" || statusFilter !== "all");

  function resetFilters() {
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    pushToast({ type: "success", message: t("toast.filterCleared") });
  }

  function requestRemoveEntry(entry) {
    setConfirmAction({
      type: "remove",
      key: entry.key,
      title: entry.record.title || t("history.thisTitle"),
    });
  }

  function requestClearHistory() {
    setConfirmAction({ type: "clear" });
  }

  function handleConfirmAction() {
    if (!confirmAction) return;
    if (confirmAction.type === "remove") onRemoveEntry(confirmAction.key);
    if (confirmAction.type === "clear") onClearHistory();
    setConfirmAction(null);
  }

  function openEntry(entry, continueReading = false, chapterOverride = null) {
    const { target } = entry;
    if (!target) return;
    const chapter = chapterOverride ? {
      url: chapterOverride.chapterUrl,
      number: chapterOverride.chapterNumber,
      name: chapterOverride.chapterName,
    } : target.chapter;

    if (target.kind === "demo") {
      if (continueReading && chapter) openReader(target.item, chapter.number);
      else openManga(target.item);
      return;
    }
    if (continueReading && chapter?.url) openLiveReader(target.item, chapter);
    else openLiveManga(target.item);
  }

  function openChapterLog(entry, event) {
    event?.stopPropagation?.();
    setChapterLogEntry(entry);
  }

  const chapterLogChapters = useMemo(() => {
    if (!chapterLogEntry) return [];
    return listTitleChapterReads(chapterReadLog, chapterLogEntry.key, chapterLogEntry.record);
  }, [chapterLogEntry, chapterReadLog]);

  const typeFilters = [
    { id: "all", label: t("content.all"), count: stats.total },
    { id: "manga", label: t("content.manga"), count: stats.manga },
    { id: "novel", label: t("content.novel"), count: stats.novel },
    { id: "anime", label: t("content.anime"), count: stats.anime },
    { id: "movie", label: t("content.movie"), count: stats.movie },
  ];

  const statusFilters = [
    { id: "all", label: t("common.all") },
    { id: "reading", label: t("history.reading") },
    { id: "done", label: t("history.completed") },
    { id: "today", label: t("history.readToday") },
  ];

  return (
    <div className="screen">
      <Header
        title={t("history.title")}
        eyebrow={stats.total ? t("history.nFollowed", { count: stats.total }) : t("history.eyebrow")}
        onBack={onBack}
        onSearch={() => navigate("search")}
        onNotifications={() => navigate("updates")}
      />
      <main className="content history-page">
        <section className="history-hero" aria-label={t("history.summary")}>
          <div className="history-hero__glow" aria-hidden="true" />
          <div className="history-hero__icon" aria-hidden="true">
            <History size={20} />
          </div>
          <div className="history-hero__copy">
            <h2>{stats.doneToday ? t("history.todayN", { count: stats.doneToday }) : t("history.continueWhere")}</h2>
            <p>
              {stats.reading
                ? t("history.inProgressTotal", { active: stats.reading, total: stats.total })
                : t("history.appearHere")}
            </p>
          </div>
          <div className="history-hero__stats">
            <span>
              <BookOpen size={13} aria-hidden="true" />
              <strong>{stats.reading}</strong>
              <small>{t("history.reading")}</small>
            </span>
            <span>
              <Check size={13} aria-hidden="true" />
              <strong>{stats.doneToday}</strong>
              <small>{t("history.today")}</small>
            </span>
            <span>
              <Clock3 size={13} aria-hidden="true" />
              <strong>{stats.total}</strong>
              <small>{t("history.log")}</small>
            </span>
          </div>
        </section>

        {stats.total > 0 && (
          <section className="history-controls" aria-label={t("history.filterAria")}>
            <AccessibleSearchField
              className="global-search history-controls__search"
              value={query}
              onChange={setQuery}
              placeholder={t("history.searchPlaceholder")}
              ariaLabel={t("history.searchAria")}
            />
            <ChipFilterBar variant="segmented" className="history-controls__types" ariaLabel={t("search.contentType")}>
              {typeFilters.map((type) => (
                <ChipFilterButton
                  key={type.id}
                  active={typeFilter === type.id}
                  disabled={!type.count && type.id !== "all"}
                  count={type.count}
                  onClick={() => setTypeFilter(type.id)}
                >
                  {type.label}
                </ChipFilterButton>
              ))}
            </ChipFilterBar>
            <div className="history-controls__status" role="group" aria-label={t("history.status")}>
              {statusFilters.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  className={statusFilter === status.id ? "active" : ""}
                  onClick={() => setStatusFilter(status.id)}
                >
                  {status.label}
                </button>
              ))}
            </div>
            <div className="history-controls__footer">
              <span>{t("search.nResults", { count: visibleEntries.length })}</span>
              <div className="history-controls__actions">
                {hasActiveFilters && (
                  <button type="button" className="history-controls__reset" onClick={resetFilters}>
                    {t("common.clearFilter")}
                  </button>
                )}
                <button type="button" className="history-controls__clear" onClick={requestClearHistory}>
                  <Trash2 size={13} aria-hidden="true" />
                  {t("history.clearLog")}
                </button>
              </div>
            </div>
          </section>
        )}

        {stats.total ? (
          visibleEntries.length ? (
            <div className="history-timeline">
              {timeline.map((group) => (
                <section className="history-day" key={group.id} aria-label={group.label}>
                  <header className="history-day__head">
                    <span>{group.label}</span>
                    <i>{group.items.length}</i>
                  </header>
                  <div className="history-day__list">
                    {group.items.map((entry) => {
                      const { record } = entry;
                      const readToday = isReadToday(record);
                      const completed = isRecordCompleted(record);
                      const progress = getRecordProgress(record);
                      const isDemo = entry.target?.kind === "demo";
                      const typeLabel = t(CONTENT_SINGULAR_KEYS[entry.type] || CONTENT_SINGULAR_KEYS.manga);
                      return (
                        <article
                          className={`history-row history-row--${entry.type}${readToday ? " history-row--today" : ""}`}
                          key={entry.key}
                        >
                          <button
                            type="button"
                            className="history-row__main"
                            onClick={() => openEntry(entry, true)}
                          >
                            <span className="history-row__media">
                              {isDemo ? (
                                <Cover item={entry.target.item} />
                              ) : record.cover ? (
                                <RemoteCover src={record.cover} title={record.title} sourceId={record.sourceId} />
                              ) : (
                                <span className="history-row__fallback">
                                  <BookOpen size={16} />
                                </span>
                              )}
                              <span className={`history-row__type history-row__type--${entry.type}`}>
                                {typeLabel}
                              </span>
                            </span>
                            <span className="history-row__body">
                              <span className="history-row__meta-line">
                                <time>{formatRelativeReadingTime(record.lastReadAt)}</time>
                                {readToday && (
                                  <span className="history-row__today">
                                    <Check size={10} aria-hidden="true" />
                                    {t("history.today")}
                                  </span>
                                )}
                              </span>
                              <strong dir="auto">{record.title || t("common.unknownTitle")}</strong>
                              {record.altTitle && (
                                <span className="history-row__subtitle" dir="auto">{record.altTitle}</span>
                              )}
                              <span className="history-row__chapter">
                                {formatHistoryUnitLabel(record)}
                                <em>{completed ? t("history.completed") : `${progress}%`}</em>
                              </span>
                              <span className="history-row__source">
                                <SourceLogo sourceId={record.sourceId} />
                                {getSourceProfile(record.sourceId).name}
                              </span>
                              <span className="history-row__track" aria-hidden="true">
                                <span style={{ width: `${progress}%` }} />
                              </span>
                            </span>
                            <ChevronLeft className="history-row__chevron" size={17} aria-hidden="true" />
                          </button>
                          <div className="history-row__aside">
                            <ReadingChapterLogButton
                              count={listTitleChapterReads(chapterReadLog, entry.key, record).length}
                              label={t("history.showLog", { title: record.title })}
                              onClick={(event) => openChapterLog(entry, event)}
                            />
                            <button
                              type="button"
                              className="history-row__details"
                              onClick={() => openEntry(entry, false)}
                            >
                              {t("history.details")}
                            </button>
                            <button
                              type="button"
                              className="history-row__continue"
                              onClick={() => openEntry(entry, true)}
                            >
                              <BookOpen size={13} aria-hidden="true" />
                              {completed && !readToday ? t("history.resume") : t("history.continue")}
                            </button>
                            <button
                              type="button"
                              className="history-row__remove"
                              onClick={() => requestRemoveEntry(entry)}
                              aria-label={t("history.remove")}
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              variant="brand"
              title={t("history.emptyFilter")}
              description={t("history.changeSearch")}
              actionLabel={t("common.clearFilter")}
              onAction={resetFilters}
            />
          )
        ) : (
          <EmptyState
            icon={History}
            variant="brand"
            title={t("history.empty")}
            description={t("history.emptyHint")}
            actionLabel={t("history.discover")}
            onAction={() => navigate("sources")}
          />
        )}
      </main>

      <ReadingChapterLogSheet
        open={Boolean(chapterLogEntry)}
        entry={chapterLogEntry}
        chapters={chapterLogChapters}
        onClose={() => setChapterLogEntry(null)}
        onOpenChapter={(chapter) => {
          if (!chapterLogEntry) return;
          openEntry(chapterLogEntry, true, chapter);
          setChapterLogEntry(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.type === "clear" ? t("history.clearAllTitle") : t("history.clearOneTitle")}
        description={
          confirmAction?.type === "clear"
            ? t("history.clearAllBody")
            : t("history.clearOneBody", { title: confirmAction?.title })
        }
        confirmLabel={confirmAction?.type === "clear" ? t("history.clearAll") : t("history.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
