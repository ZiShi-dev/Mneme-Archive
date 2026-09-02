import React from "react";
import { BookOpen, ChevronLeft, Clapperboard } from "lucide-react";
import { getRecordProgress, isReadToday, isRecordCompleted, formatHistoryUnitLabel } from "../../lib/readingProgress";
import { getMediaPresentation } from "./mediaPresentation";
import { useI18n } from "../../i18n/I18nProvider";
import { isAzoraChapterBlocked } from "../../lib/media/chapterLock";

function formatStartChapterLabel(chapter, presentation) {
  const number = String(chapter?.number || chapter?.name || "").trim();
  if (!number) return presentation.startAction;
  return `${presentation.rowPrefix} ${number}`;
}

export function DetailsActionHub({
  mediaType = "manga",
  firstChapter,
  readingProgress,
  continueChapter,
  onOpenChapter,
  sourceId,
}) {
  const { t } = useI18n();
  const presentation = getMediaPresentation(mediaType);
  const hasContinue = Boolean(readingProgress && continueChapter);
  const targetChapter = hasContinue ? continueChapter : firstChapter;
  const targetBlocked = isAzoraChapterBlocked(sourceId, targetChapter);

  if (!targetChapter) return null;

  const progress = hasContinue ? getRecordProgress(readingProgress) : 0;
  const readToday = hasContinue && isReadToday(readingProgress);
  const completed = hasContinue && isRecordCompleted(readingProgress);
  const continueHint = completed
    ? (readToday ? presentation.watchedToday : presentation.lastUnitComplete)
    : t("history.resume");

  const PlayIcon = presentation.isVideo ? Clapperboard : BookOpen;

  return (
    <section className="details-hub" aria-label={t("details.quickActions")}>
      <button
        type="button"
        className={`details-hub__primary${readToday ? " details-hub__primary--today" : ""}`}
        disabled={targetBlocked}
        onClick={() => { if (!targetBlocked) onOpenChapter(targetChapter); }}
      >
        <span className="details-hub__primary-icon" aria-hidden="true">
          <PlayIcon size={18} />
        </span>
        <span className="details-hub__primary-copy">
          <small>{hasContinue ? continueHint : presentation.startAction}</small>
          <strong>
            {hasContinue
              ? formatHistoryUnitLabel(readingProgress)
              : formatStartChapterLabel(firstChapter, presentation)}
          </strong>
        </span>
        {hasContinue ? <em>{progress}%</em> : null}
        <ChevronLeft size={16} className="details-hub__primary-arrow" aria-hidden="true" />
        {hasContinue ? (
          <span className="details-hub__progress" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </span>
        ) : null}
      </button>
    </section>
  );
}
