import React from "react";
import { ChevronLeft, Clapperboard } from "lucide-react";
import { formatHistoryUnitLabel, getRecordProgress, isReadToday, isRecordCompleted } from "../../../lib/readingProgress";
import { useI18n } from "../../../i18n/I18nProvider";

export function MovieWatchActions({
  presentation,
  latestChapter,
  continueChapter,
  readingProgress,
  audioLanguage,
  onOpen,
  audioPicker,
}) {
  const { t } = useI18n();
  const hasContinue = Boolean(readingProgress && continueChapter);
  const targetChapter = hasContinue ? continueChapter : latestChapter;

  if (!targetChapter) {
    return audioPicker ? <div className="details-movie-hero-actions">{audioPicker}</div> : null;
  }

  const progress = hasContinue ? getRecordProgress(readingProgress) : 0;
  const readToday = hasContinue && isReadToday(readingProgress);
  const completed = hasContinue && isRecordCompleted(readingProgress);
  const hint = hasContinue
    ? (completed ? (readToday ? presentation.watchedToday : presentation.lastUnitComplete) : presentation.continueAction)
    : t("media.readyToPlay");
  const title = hasContinue
    ? formatHistoryUnitLabel(readingProgress)
    : presentation.watchLatest;

  return (
    <div className="details-movie-hero-actions">
      <button
        type="button"
        className={`details-movie-watch${readToday ? " details-movie-watch--today" : ""}`}
        onClick={() => onOpen(targetChapter)}
      >
        <span className="details-movie-watch__icon" aria-hidden="true">
          <Clapperboard size={20} />
        </span>
        <span className="details-movie-watch__copy">
          <small>{hint}</small>
          <strong>{title}</strong>
        </span>
        {hasContinue && !completed ? (
          <em className="details-movie-watch__progress">{progress}%</em>
        ) : (
          <span className="details-movie-watch__badge">{audioLanguage || t("media.movieHd")}</span>
        )}
        <ChevronLeft size={18} className="details-movie-watch__arrow" aria-hidden="true" />
        {hasContinue && !completed ? (
          <span className="details-movie-watch__track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </span>
        ) : null}
      </button>
      {audioPicker}
    </div>
  );
}
