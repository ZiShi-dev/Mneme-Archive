import React from "react";
import { BookOpen, ChevronLeft, Clapperboard, Layers, Radio, Sparkles } from "lucide-react";
import { getRecordProgress, isReadToday, isRecordCompleted, formatHistoryUnitLabel } from "../../lib/readingProgress";
import { getMediaPresentation } from "./mediaPresentation";
import { useI18n } from "../../i18n/I18nProvider";

export function DetailsActionHub({
  mediaType = "manga",
  chaptersCount,
  latestChapter,
  sourceName,
  readingProgress,
  continueChapter,
  onOpenChapter,
}) {
  const { t } = useI18n();
  const presentation = getMediaPresentation(mediaType);
  const hasContinue = Boolean(readingProgress && continueChapter);
  const latestNumber = latestChapter?.number || latestChapter?.name || "—";
  const isSameAsContinue = hasContinue && continueChapter?.url === latestChapter?.url;
  const showLatestAction = latestChapter && (!hasContinue || !isSameAsContinue);

  const progress = hasContinue ? getRecordProgress(readingProgress) : 0;
  const readToday = hasContinue && isReadToday(readingProgress);
  const completed = hasContinue && isRecordCompleted(readingProgress);
  const continueHint = completed
    ? (readToday ? presentation.watchedToday : presentation.lastUnitComplete)
    : presentation.continueAction;

  const PrimaryIcon = presentation.isVideo ? Clapperboard : BookOpen;
  const LatestIcon = presentation.isVideo ? Clapperboard : BookOpen;

  return (
    <section className="details-hub" aria-label={t("details.quickActions")}>
      <div className="details-hub__stats">
        <div className="details-hub__stat">
          <Layers size={14} aria-hidden="true" />
          <span>
            <strong>{chaptersCount || "—"}</strong>
            <small>{presentation.unitsStat}</small>
          </span>
        </div>
        <div className="details-hub__stat">
          <Sparkles size={14} aria-hidden="true" />
          <span>
            <strong>{latestNumber}</strong>
            <small>{presentation.latestStat}</small>
          </span>
        </div>
        <div className="details-hub__stat">
          <Radio size={14} aria-hidden="true" />
          <span>
            <strong className="details-hub__source">{sourceName}</strong>
            <small>{t("details.source")}</small>
          </span>
        </div>
      </div>

      <div className="details-hub__actions">
        {hasContinue && (
          <button
            type="button"
            className={`details-hub__primary${readToday ? " details-hub__primary--today" : ""}${presentation.isVideo ? " details-hub__primary--video" : ""}`}
            onClick={() => onOpenChapter(continueChapter)}
          >
            <span className="details-hub__primary-icon" aria-hidden="true">
              <PrimaryIcon size={18} />
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
            className={`details-hub__latest${hasContinue ? " details-hub__latest--secondary" : ""}${presentation.isVideo ? " details-hub__latest--video" : ""}`}
            onClick={() => onOpenChapter(latestChapter)}
          >
            <span className="details-hub__latest-copy">
              <small>{hasContinue ? presentation.orWatchLatest : presentation.watchFromLatest}</small>
              <strong>{presentation.watchLatest} {latestNumber}</strong>
            </span>
            <span className="details-hub__latest-icon" aria-hidden="true">
              <LatestIcon size={17} />
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
