import React from "react";
import { Check, ChevronLeft } from "lucide-react";
import { formatHistoryUnitLabel, getRecordProgress, isReadToday, isRecordCompleted } from "../../lib/readingProgress";
import { resolveBookmarkType } from "./contentTypes";
import { getMediaPresentation } from "./mediaPresentation";

export function ReadingContinueCard({ record, chapter, onContinue }) {
  if (!record || !chapter) return null;

  const readToday = isReadToday(record);
  const completed = isRecordCompleted(record);
  const progress = getRecordProgress(record);
  const presentation = getMediaPresentation(resolveBookmarkType(record));
  const hint = completed
    ? (readToday ? presentation.watchedToday : presentation.lastUnitComplete)
    : presentation.continueAction;

  return (
    <section
      className={`details-reading-card${readToday ? " details-reading-card--today" : ""}`}
      aria-label={presentation.continueAction}
    >
      <button type="button" className="details-reading-card__main" onClick={() => onContinue(chapter)}>
        <span className="details-reading-card__copy">
          <small>{hint}</small>
          <span className="details-reading-card__title">
            <strong>{formatHistoryUnitLabel(record)}</strong>
            <em>{progress}%</em>
          </span>
        </span>
        {readToday && (
          <span className="details-reading-card__badge" aria-hidden="true">
            <Check size={10} />
          </span>
        )}
        <ChevronLeft size={16} className="details-reading-card__arrow" aria-hidden="true" />
      </button>
      <div className="details-reading-card__track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}
