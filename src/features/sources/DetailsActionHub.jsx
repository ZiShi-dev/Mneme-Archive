import React from "react";
import { BookOpen, ChevronLeft, Clapperboard } from "lucide-react";
import { getRecordProgress, isReadToday, isRecordCompleted, formatHistoryUnitLabel } from "../../lib/readingProgress";
import { getMediaPresentation } from "./mediaPresentation";
import { useI18n } from "../../i18n/I18nProvider";

export function DetailsActionHub({
  mediaType = "manga",
  latestChapter,
  readingProgress,
  continueChapter,
  onOpenChapter,
}) {
  const { t } = useI18n();
  const presentation = getMediaPresentation(mediaType);
  const hasContinue = Boolean(readingProgress && continueChapter);
  const latestNumber = latestChapter?.number || latestChapter?.name || "";
  const isSameAsContinue = hasContinue && continueChapter?.url === latestChapter?.url;
  const showLatestAction = latestChapter && (!hasContinue || !isSameAsContinue);

  if (!hasContinue && !showLatestAction) return null;

  const progress = hasContinue ? getRecordProgress(readingProgress) : 0;
  const readToday = hasContinue && isReadToday(readingProgress);
  const completed = hasContinue && isRecordCompleted(readingProgress);
  const continueHint = completed
    ? (readToday ? presentation.watchedToday : presentation.lastUnitComplete)
    : presentation.continueAction;

  const PlayIcon = presentation.isVideo ? Clapperboard : BookOpen;

  return (
    <section className="details-hub" aria-label={t("details.quickActions")}>
      {hasContinue && (
        <button
          type="button"
          className={`details-hub__primary${readToday ? " details-hub__primary--today" : ""}`}
          onClick={() => onOpenChapter(continueChapter)}
        >
          <span className="details-hub__primary-icon" aria-hidden="true">
            <PlayIcon size={18} />
          </span>
          <span className="details-hub__primary-copy">
            <small>{continueHint}</small>
            <strong>{formatHistoryUnitLabel(readingProgress)}</strong>
          </span>
          <em>{progress}%</em>
          <ChevronLeft size={16} className="details-hub__primary-arrow" aria-hidden="true" />
          <span className="details-hub__progress" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </span>
        </button>
      )}

      {showLatestAction && (
        <button
          type="button"
          className={`details-hub__latest${hasContinue ? " details-hub__latest--secondary" : ""}`}
          onClick={() => onOpenChapter(latestChapter)}
        >
          <span className="details-hub__latest-copy">
            <small>{hasContinue ? presentation.orWatchLatest : presentation.watchFromLatest}</small>
            <strong>{latestNumber ? `${presentation.watchLatest} ${latestNumber}` : presentation.watchLatest}</strong>
          </span>
          <span className="details-hub__latest-icon" aria-hidden="true">
            <PlayIcon size={17} />
          </span>
        </button>
      )}
    </section>
  );
}
