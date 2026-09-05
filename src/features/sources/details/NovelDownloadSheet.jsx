import React, { useEffect, useMemo, useState } from "react";
import { Download, Layers, ListOrdered } from "lucide-react";
import { SheetCloseButton } from "../../../components/ui/SheetCloseButton";
import { SheetPortal } from "../../../components/ui/SheetPortal";
import { useI18n } from "../../../i18n/I18nProvider";
import {
  chapterRangeOptionLabel,
  findChapterByNumber,
  resolveChapterNumber,
  sliceChaptersInRange,
  sortChaptersAsc,
} from "../../../lib/downloads/chapterDownloadRange.js";
import { estimateDownloadBatch } from "../../../lib/downloads/chapterDownloadService.js";
import { formatBytes, formatDataUsage } from "../../../lib/downloads/formatBytes";

function formatEstimateHint(estimate, locale, t, mediaKey = "novel") {
  if (!estimate || estimate.pendingCount === 0) {
    return t(`downloads.${mediaKey}.confirmAlreadySaved`);
  }
  const storage = formatBytes(estimate.storageBytes, locale);
  const data = formatDataUsage(estimate.dataBytes, locale);
  const approx = estimate.precise ? "" : ` · ${t(`downloads.${mediaKey}.confirmApproximate`)}`;
  return t(`downloads.${mediaKey}.sheetSizeHint`, { storage, data }) + approx;
}

export function NovelDownloadSheet({
  open,
  onClose,
  mediaKey = "novel",
  onDownloadChapter,
  onDownloadAll,
  onDownloadRange,
  busy = false,
  progress = null,
  backgroundProgress = null,
  onPauseBackground,
  onResumeBackground,
  onCancelBackground,
  chapterLabel = "",
  chapterEstimate = null,
  allEstimate = null,
  rangeChapters = [],
  defaultRangeFromUrl = "",
  sourceId,
  downloadItem,
  rawDownloads,
}) {
  const { t, locale, dir } = useI18n();
  const sortedRangeChapters = useMemo(() => sortChaptersAsc(rangeChapters), [rangeChapters]);
  const [rangeFromNumber, setRangeFromNumber] = useState("");
  const [rangeToNumber, setRangeToNumber] = useState("");

  useEffect(() => {
    if (!open || !sortedRangeChapters.length) return;
    const defaultChapter = sortedRangeChapters.find((chapter) => chapter.url === defaultRangeFromUrl)
      || sortedRangeChapters[0];
    const lastChapter = sortedRangeChapters[sortedRangeChapters.length - 1];
    setRangeFromNumber(resolveChapterNumber(defaultChapter));
    setRangeToNumber(resolveChapterNumber(lastChapter));
  }, [defaultRangeFromUrl, open, sortedRangeChapters]);

  const rangeFromChapter = useMemo(
    () => findChapterByNumber(sortedRangeChapters, rangeFromNumber),
    [rangeFromNumber, sortedRangeChapters],
  );
  const rangeToChapter = useMemo(
    () => findChapterByNumber(sortedRangeChapters, rangeToNumber),
    [rangeToNumber, sortedRangeChapters],
  );

  const selectedRangeChapters = useMemo(() => {
    if (!rangeFromChapter || !rangeToChapter) return [];
    return sliceChaptersInRange(sortedRangeChapters, rangeFromChapter.url, rangeToChapter.url);
  }, [rangeFromChapter, rangeToChapter, sortedRangeChapters]);

  const rangeError = useMemo(() => {
    const fromValue = rangeFromNumber.trim();
    const toValue = rangeToNumber.trim();
    if (!fromValue && !toValue) return "";
    if (fromValue && !rangeFromChapter) {
      return t(`downloads.${mediaKey}.rangeFromMissing`, { number: fromValue });
    }
    if (toValue && !rangeToChapter) {
      return t(`downloads.${mediaKey}.rangeToMissing`, { number: toValue });
    }
    return "";
  }, [rangeFromChapter, rangeFromNumber, rangeToChapter, rangeToNumber, t]);

  const rangeEstimate = useMemo(() => {
    if (!selectedRangeChapters.length || !sourceId || !downloadItem) return null;
    return estimateDownloadBatch(
      sourceId,
      selectedRangeChapters,
      downloadItem,
      rawDownloads,
    );
  }, [downloadItem, rawDownloads, selectedRangeChapters, sourceId]);

  if (!open) return null;

  const chapterHint = formatEstimateHint(chapterEstimate, locale, t, mediaKey);
  const allHint = allEstimate?.pendingCount
    ? formatEstimateHint(allEstimate, locale, t, mediaKey)
    : t(`downloads.${mediaKey}.downloadAllHint`);
  const rangeHint = rangeError
    ? rangeError
    : formatEstimateHint(rangeEstimate, locale, t, mediaKey);
  const canDownloadRange = !busy
    && !rangeError
    && rangeFromChapter
    && rangeToChapter
    && Boolean(rangeEstimate?.pendingCount);
  const isBackgroundPaused = backgroundProgress?.status === "paused";
  const isBackgroundRunning = backgroundProgress?.status === "running";

  return (
    <SheetPortal>
      <div
        className="notify-sheet-backdrop novel-download-sheet-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section
          className="notify-sheet novel-download-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="novel-download-sheet-title"
          dir={dir}
        >
          <header>
            <div>
              <small>{t(`downloads.${mediaKey}.sheetEyebrow`)}</small>
              <h2 id="novel-download-sheet-title">{t(`downloads.${mediaKey}.sheetTitle`)}</h2>
            </div>
            <SheetCloseButton onClick={onClose} label={t("common.close")} />
          </header>
          <div className="notify-sheet__body novel-download-sheet__body">
            {backgroundProgress ? (
              <div className="novel-download-sheet__background" role="status">
                <p className="novel-download-sheet__progress">
                  {isBackgroundPaused
                    ? t("downloads.backgroundPaused", {
                      done: backgroundProgress.completed,
                      total: backgroundProgress.total,
                    })
                    : t("downloads.backgroundProgress", {
                      done: backgroundProgress.completed,
                      total: backgroundProgress.total,
                    })}
                </p>
                <div className="novel-download-sheet__controls">
                  {isBackgroundPaused && onResumeBackground ? (
                    <button
                      type="button"
                      className="novel-download-sheet__control novel-download-sheet__control--primary"
                      onClick={onResumeBackground}
                    >
                      {t("downloads.resumeBackground")}
                    </button>
                  ) : null}
                  {isBackgroundRunning && onPauseBackground ? (
                    <button
                      type="button"
                      className="novel-download-sheet__control"
                      onClick={onPauseBackground}
                    >
                      {t("downloads.pauseBackground")}
                    </button>
                  ) : null}
                  {onCancelBackground ? (
                    <button
                      type="button"
                      className="novel-download-sheet__control novel-download-sheet__control--danger"
                      onClick={onCancelBackground}
                    >
                      {t("downloads.cancelBackground")}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : progress ? (
              <p className="novel-download-sheet__progress" role="status">
                {t(`downloads.${mediaKey}.batchProgress`, { done: progress.completed, total: progress.total })}
              </p>
            ) : null}
            <button
              type="button"
              className="novel-download-sheet__action"
              disabled={busy || !chapterEstimate?.pendingCount}
              onClick={onDownloadChapter}
            >
              <Download size={18} aria-hidden="true" />
              <span>
                <strong>{t(`downloads.${mediaKey}.downloadChapter`)}</strong>
                {chapterLabel ? <small>{chapterLabel}</small> : null}
                <small>{chapterHint}</small>
              </span>
            </button>

            {sortedRangeChapters.length > 1 ? (
              <div className="novel-download-sheet__range">
                <div className="novel-download-sheet__range-head">
                  <ListOrdered size={17} aria-hidden="true" />
                  <strong>{t(`downloads.${mediaKey}.rangeTitle`)}</strong>
                </div>
                <div className="novel-download-sheet__range-fields">
                  <label className="novel-download-sheet__range-field">
                    <span>{t(`downloads.${mediaKey}.rangeFrom`)}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rangeFromNumber}
                      onChange={(event) => setRangeFromNumber(event.target.value)}
                      disabled={busy}
                      placeholder={t(`downloads.${mediaKey}.rangeNumberPlaceholder`)}
                      aria-label={t(`downloads.${mediaKey}.rangeFrom`)}
                      aria-invalid={Boolean(rangeFromNumber.trim() && !rangeFromChapter)}
                    />
                  </label>
                  <label className="novel-download-sheet__range-field">
                    <span>{t(`downloads.${mediaKey}.rangeTo`)}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rangeToNumber}
                      onChange={(event) => setRangeToNumber(event.target.value)}
                      disabled={busy}
                      placeholder={t(`downloads.${mediaKey}.rangeNumberPlaceholder`)}
                      aria-label={t(`downloads.${mediaKey}.rangeTo`)}
                      aria-invalid={Boolean(rangeToNumber.trim() && !rangeToChapter)}
                    />
                  </label>
                </div>
                <p className={`novel-download-sheet__range-summary${rangeError ? " is-error" : ""}`}>
                  {rangeError
                    ? rangeError
                    : selectedRangeChapters.length
                      ? t(`downloads.${mediaKey}.rangeSelected`, { count: selectedRangeChapters.length })
                        + (rangeFromChapter && rangeToChapter
                          ? ` · ${chapterRangeOptionLabel(rangeFromChapter)} → ${chapterRangeOptionLabel(rangeToChapter)}`
                          : "")
                      : t(`downloads.${mediaKey}.rangeEnterNumbers`)}
                </p>
                <button
                  type="button"
                  className="novel-download-sheet__action novel-download-sheet__action--range"
                  disabled={!canDownloadRange}
                  onClick={() => onDownloadRange?.(selectedRangeChapters)}
                >
                  <ListOrdered size={18} aria-hidden="true" />
                  <span>
                    <strong>{t(`downloads.${mediaKey}.downloadRange`)}</strong>
                    <small>{rangeHint}</small>
                  </span>
                </button>
              </div>
            ) : null}

            <button
              type="button"
              className="novel-download-sheet__action"
              disabled={busy || !allEstimate?.pendingCount}
              onClick={onDownloadAll}
            >
              <Layers size={18} aria-hidden="true" />
              <span>
                <strong>{t(`downloads.${mediaKey}.downloadAll`)}</strong>
                <small>{allHint}</small>
              </span>
            </button>
          </div>
        </section>
      </div>
    </SheetPortal>
  );
}
