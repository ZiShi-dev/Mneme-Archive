import React, { useEffect, useMemo } from "react";
import { BookOpen, Check, ListOrdered } from "lucide-react";
import { SheetCloseButton } from "../components/ui/SheetCloseButton";
import { SheetPortal } from "../components/ui/SheetPortal";
import { RemoteCover } from "../features/sources";
import { Cover } from "../components/manga/Cover";
import { groupChapterReadsByDay } from "../lib/reading/backfillChapterReadLog";
import { chapterLabel, formatChapterReadDate } from "../lib/reading/chapterReadLog";
import { useI18n } from "../i18n/I18nProvider";

const MEDIA_TYPE_KEYS = {
  manga: "media.manga",
  novel: "media.novel",
  anime: "media.anime",
  movie: "media.movie",
  series: "media.series",
};

function resolveUnitLabel(type, t) {
  if (type === "movie") return t("media.movie");
  if (type === "anime" || type === "series") return t("media.episode");
  return t("media.chapter");
}

export function ReadingChapterLogSheet({
  open,
  onClose,
  entry,
  chapters,
  onOpenChapter,
}) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  const completedCount = useMemo(
    () => (chapters || []).filter((chapter) => chapter.completed).length,
    [chapters],
  );
  const groupedChapters = useMemo(
    () => groupChapterReadsByDay(chapters || []),
    [chapters],
  );

  if (!open || !entry) return null;

  const { record, type, target } = entry;
  const isDemo = target?.kind === "demo";
  const mediaLabel = t(MEDIA_TYPE_KEYS[type] || MEDIA_TYPE_KEYS.manga);
  const unitLabel = resolveUnitLabel(type, t);

  return (
    <SheetPortal>
    <div
      className="notify-sheet-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="notify-sheet history-chapter-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-chapter-sheet-title"
      >
        <header>
          <div className="history-chapter-sheet__head">
            <span className="history-chapter-sheet__cover">
              {isDemo ? (
                <Cover item={target.item} />
              ) : record.cover ? (
                <RemoteCover src={record.cover} title={record.title} />
              ) : (
                <span className="history-chapter-sheet__cover-fallback"><BookOpen size={16} /></span>
              )}
            </span>
            <div>
              <small>
                {mediaLabel} · {chapters.length} {unitLabel}
                {completedCount ? ` · ${t("history.nComplete", { count: completedCount })}` : ""}
              </small>
              <h2 id="history-chapter-sheet-title" dir="auto">{record.title || t("common.unknownTitle")}</h2>
            </div>
          </div>
          <SheetCloseButton onClick={onClose} />
        </header>

        <div className="notify-sheet__body history-chapter-sheet__body">
          {chapters.length ? (
            <div className="history-chapter-sheet__groups">
              {groupedChapters.map((group) => (
                <section key={group.id} className="history-chapter-sheet__group">
                  <header className="history-chapter-sheet__group-head">
                    <span>{group.label}</span>
                    <i>{group.items.length}</i>
                  </header>
                  <ul className="history-chapter-sheet__list">
                    {group.items.map((chapter) => (
                      <li key={chapter.chapterUrl}>
                        <button
                          type="button"
                          className="history-chapter-sheet__row"
                          onClick={() => onOpenChapter?.(chapter)}
                        >
                          <span className="history-chapter-sheet__row-copy">
                            <strong>{chapterLabel(chapter, type)}</strong>
                            <small>{formatChapterReadDate(chapter.readAt)}</small>
                          </span>
                          <span className={`history-chapter-sheet__status${chapter.completed ? " history-chapter-sheet__status--done" : ""}`}>
                            {chapter.completed ? (
                              <>
                                <Check size={12} />
                                {t("history.completed")}
                              </>
                            ) : (
                              `${chapter.progress}%`
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="history-chapter-sheet__empty">
              {type === "anime" || type === "movie" ? t("history.noWatchYet") : t("history.noReadYet")}
            </p>
          )}
        </div>

        <footer className="history-chapter-sheet__footer">
          <button type="button" className="notify-sheet__done history-chapter-sheet__done" onClick={onClose}>
            {t("common.done")}
          </button>
        </footer>
      </section>
    </div>
    </SheetPortal>
  );
}

export function ReadingChapterLogButton({ onClick, count = 0, label }) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      className="history-row__chapters"
      onClick={onClick}
      aria-label={label || t("history.showRead", { count })}
    >
      <ListOrdered size={13} aria-hidden="true" />
      <span>{count || 1}</span>
    </button>
  );
}
