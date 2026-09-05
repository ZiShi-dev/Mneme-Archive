import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Check, ChevronLeft, ChevronRight, Lock, Search } from "lucide-react";
import { AccessibleSearchField } from "../../components/ui/AccessibleSearchField";
import { SheetCloseButton } from "../../components/ui/SheetCloseButton";
import { SheetPortal } from "../../components/ui/SheetPortal";
import { useI18n } from "../../i18n/I18nProvider";
import { getChapterProgress, isChapterInProgress, isChapterRead } from "../../lib/storage/chapterProgress";
import { chapterSortKey } from "../../../server/lib/chapterOrdering.js";
import { chapterMatchesQuery } from "../../lib/reading/chapterListQuery.js";
import { getMediaPresentation } from "./mediaPresentation";
import { UnlockCountdown } from "../../components/media/UnlockCountdown";
import { resolveBookmarkType } from "./contentTypes";

const PAGE_SIZE = 40;

function isSameChapter(left, right) {
  if (!left || !right) return false;
  if (left.url && right.url && left.url === right.url) return true;
  return Boolean(left.number) && String(left.number) === String(right.number);
}

function sortChapters(chapters, order) {
  const sorted = [...chapters].sort((left, right) => {
    const diff = chapterSortKey(right) - chapterSortKey(left);
    if (diff !== 0) return diff;
    return String(right.url || "").localeCompare(String(left.url || ""), undefined, { numeric: true });
  });
  return order === "desc" ? sorted : sorted.slice().reverse();
}

function findChapterPage(chapters, activeChapter, pageSize) {
  if (!activeChapter || !chapters.length) return 1;
  const index = chapters.findIndex((chapter) => isSameChapter(chapter, activeChapter));
  if (index < 0) return 1;
  return Math.floor(index / pageSize) + 1;
}

const ChapterListItem = memo(function ChapterListItem({
  chapter,
  isActive,
  sourceId,
  presentation,
  onSelect,
  itemRef,
}) {
  const locked = Boolean(chapter.locked);
  const progress = getChapterProgress(sourceId, chapter.url);
  const read = !locked && isChapterRead(sourceId, chapter.url, progress);
  const inProgress = !locked && isChapterInProgress(sourceId, chapter.url, progress);
  const label = chapter.name || chapter.number || presentation.unit;

  return (
    <button
      ref={itemRef}
      type="button"
      role="option"
      aria-selected={isActive}
      aria-current={isActive ? "true" : undefined}
      className={[
        "reader-chapter-list__item",
        isActive ? "is-active" : "",
        locked ? "is-locked" : "",
        read ? "is-complete" : "",
      ].filter(Boolean).join(" ")}
      disabled={locked}
      onClick={() => {
        if (locked) return;
        onSelect(chapter);
      }}
      aria-label={locked ? presentation.lockedAria(label) : presentation.openAria(label)}
    >
      <span className="reader-chapter-list__number">{chapter.number || "—"}</span>
      <span className="reader-chapter-list__copy">
        <strong dir="auto">{label}</strong>
        {inProgress ? <small>{progress}%</small> : null}
      </span>
      {locked ? (
        <>
          <UnlockCountdown unlockAt={chapter.unlockAt} className="unlock-countdown--compact" />
          <Lock size={14} aria-hidden="true" />
        </>
      ) : null}
      {read ? <Check size={14} aria-hidden="true" /> : null}
    </button>
  );
});

export function ReaderChapterListSheet({
  manga,
  chapters,
  activeChapter,
  sourceId,
  loading = false,
  theme = "night",
  onSelect,
  onClose,
}) {
  const { t, dir } = useI18n();
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const listRef = useRef(null);
  const activeRef = useRef(null);
  const didScrollToActiveRef = useRef(false);
  const presentation = useMemo(
    () => getMediaPresentation(resolveBookmarkType(manga) || manga?.type || "manga"),
    [manga],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const showTools = chapters.length > 8;

  const filteredChapters = useMemo(() => {
    // Liste déjà triée desc côté lecteur : éviter un re-tri coûteux à l’ouverture.
    if (!normalizedQuery && order === "desc") return chapters;
    const matches = normalizedQuery
      ? chapters.filter((chapter) => chapterMatchesQuery(chapter, normalizedQuery))
      : chapters;
    return sortChapters(matches, order);
  }, [chapters, normalizedQuery, order]);

  const totalPages = Math.max(1, Math.ceil(filteredChapters.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedChapters = filteredChapters.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(findChapterPage(filteredChapters, activeChapter, PAGE_SIZE));
    didScrollToActiveRef.current = false;
  }, [activeChapter?.number, activeChapter?.url, filteredChapters, normalizedQuery, order]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    const scroller = listRef.current;
    if (!scroller) return undefined;
    if (!didScrollToActiveRef.current && activeRef.current) {
      didScrollToActiveRef.current = true;
      const frame = window.requestAnimationFrame(() => {
        activeRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
      });
      return () => window.cancelAnimationFrame(frame);
    }
    scroller.scrollTop = 0;
    return undefined;
  }, [safePage, order, normalizedQuery, activeChapter?.url]);

  function goToPage(nextPage) {
    const clamped = Math.min(totalPages, Math.max(1, nextPage));
    didScrollToActiveRef.current = true;
    setPage(clamped);
  }

  return (
    <SheetPortal>
      <div
        className="reader-settings-backdrop reader-chapter-list-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onTouchStart={(event) => {
          event.stopPropagation();
        }}
      >
        <section
          className={`reader-settings reader-chapter-list reader-settings--theme-${theme}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reader-chapter-list-title"
          dir={dir}
          onTouchStart={(event) => event.stopPropagation()}
        >
          <header>
            <div>
              <small>{presentation.sectionTitle}</small>
              <h2 id="reader-chapter-list-title">
                {loading ? "…" : filteredChapters.length}
                <span> {presentation.units}</span>
                {normalizedQuery && filteredChapters.length !== chapters.length ? (
                  <span className="reader-chapter-list__filtered-of"> / {chapters.length}</span>
                ) : null}
              </h2>
            </div>
            <SheetCloseButton onClick={onClose} label={t("reader.playback.closeChapterList")} />
          </header>

          {showTools ? (
            <div className="reader-chapter-list__tools">
              <AccessibleSearchField
                className="global-search chapter-search reader-chapter-list__search"
                value={query}
                onChange={setQuery}
                placeholder={presentation.searchPlaceholder}
                ariaLabel={t("details.searchInUnits", { units: presentation.units })}
              />
              <button
                type="button"
                className="reader-chapter-list__order"
                onClick={() => setOrder((current) => (current === "desc" ? "asc" : "desc"))}
              >
                <ArrowUpDown size={15} aria-hidden="true" />
                <span>{order === "desc" ? t("details.newestFirst") : t("details.oldestFirst")}</span>
              </button>
            </div>
          ) : null}

          <div className="reader-settings__body reader-chapter-list__body" ref={listRef}>
            {loading && !chapters.length ? (
              <p className="reader-chapter-list__empty">{presentation.loadingList}</p>
            ) : pagedChapters.length ? (
              <div className="reader-chapter-list__items" role="listbox" aria-label={presentation.sectionTitle}>
                {pagedChapters.map((chapter) => {
                  const isActive = isSameChapter(chapter, activeChapter);
                  return (
                    <ChapterListItem
                      key={chapter.url}
                      chapter={chapter}
                      isActive={isActive}
                      sourceId={sourceId}
                      presentation={presentation}
                      onSelect={onSelect}
                      itemRef={isActive ? activeRef : null}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="reader-chapter-list__empty">
                <Search size={26} aria-hidden="true" />
                <p>{presentation.noMatch}</p>
                {normalizedQuery ? (
                  <button type="button" className="reader-chapter-list__clear" onClick={() => setQuery("")}>
                    {t("common.clearSearch")}
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {filteredChapters.length > PAGE_SIZE ? (
            <nav className="reader-chapter-list__pagination" aria-label={presentation.paginationAria}>
              <button
                type="button"
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage <= 1}
                aria-label={t("common.previous")}
              >
                <ChevronRight size={17} aria-hidden="true" />
              </button>
              <span>
                <small>{t("common.page")}</small>
                <strong>{safePage}</strong>
                <small>{t("common.of", { total: totalPages })}</small>
              </span>
              <button
                type="button"
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage >= totalPages}
                aria-label={t("common.next")}
              >
                <ChevronLeft size={17} aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </section>
      </div>
    </SheetPortal>
  );
}
