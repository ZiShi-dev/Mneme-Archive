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
import { estimateNovelDownloadBatch } from "../../../lib/downloads/estimateNovelDownloadSizeWithCache.js";
import { formatBytes, formatDataUsage } from "../../../lib/downloads/formatBytes";

function formatEstimateHint(estimate, locale, t) {
  if (!estimate || estimate.pendingCount === 0) {
    return t("downloads.novel.confirmAlreadySaved");
  }
  const storage = formatBytes(estimate.storageBytes, locale);
  const data = formatDataUsage(estimate.dataBytes, locale);
  const approx = estimate.precise ? "" : ` · ${t("downloads.novel.confirmApproximate")}`;
  return t("downloads.novel.sheetSizeHint", { storage, data }) + approx;
}

export function NovelDownloadSheet({
  open,
  onClose,
  onDownloadChapter,
  onDownloadAll,
  onDownloadRange,
  busy = false,
  progress = null,
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
      return t("downloads.novel.rangeFromMissing", { number: fromValue });
    }
    if (toValue && !rangeToChapter) {
      return t("downloads.novel.rangeToMissing", { number: toValue });
    }
    return "";
  }, [rangeFromChapter, rangeFromNumber, rangeToChapter, rangeToNumber, t]);

  const rangeEstimate = useMemo(() => {
    if (!selectedRangeChapters.length || !sourceId || !downloadItem) return null;
    return estimateNovelDownloadBatch(
      sourceId,
      selectedRangeChapters,
      downloadItem,
      rawDownloads,
    );
  }, [downloadItem, rawDownloads, selectedRangeChapters, sourceId]);

  if (!open) return null;

  const chapterHint = formatEstimateHint(chapterEstimate, locale, t);
  const allHint = allEstimate?.pendingCount
    ? formatEstimateHint(allEstimate, locale, t)
    : t("downloads.novel.downloadAllHint");
  const rangeHint = rangeError
    ? rangeError
    : formatEstimateHint(rangeEstimate, locale, t);
  const canDownloadRange = !busy
    && !rangeError
    && rangeFromChapter
    && rangeToChapter
    && Boolean(rangeEstimate?.pendingCount);

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
              <small>{t("downloads.novel.sheetEyebrow")}</small>
              <h2 id="novel-download-sheet-title">{t("downloads.novel.sheetTitle")}</h2>
            </div>
            <SheetCloseButton onClick={onClose} label={t("common.close")} />
          </header>
          <div className="notify-sheet__body novel-download-sheet__body">
            {progress ? (
              <p className="novel-download-sheet__progress" role="status">
                {t("downloads.novel.batchProgress", { done: progress.completed, total: progress.total })}
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
                <strong>{t("downloads.novel.downloadChapter")}</strong>
                {chapterLabel ? <small>{chapterLabel}</small> : null}
                <small>{chapterHint}</small>
              </span>
            </button>

            {sortedRangeChapters.length > 1 ? (
              <div className="novel-download-sheet__range">
                <div className="novel-download-sheet__range-head">
                  <ListOrdered size={17} aria-hidden="true" />
                  <strong>{t("downloads.novel.rangeTitle")}</strong>
                </div>
                <div className="novel-download-sheet__range-fields">
                  <label className="novel-download-sheet__range-field">
                    <span>{t("downloads.novel.rangeFrom")}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rangeFromNumber}
                      onChange={(event) => setRangeFromNumber(event.target.value)}
                      disabled={busy}
                      placeholder={t("downloads.novel.rangeNumberPlaceholder")}
                      aria-label={t("downloads.novel.rangeFrom")}
                      aria-invalid={Boolean(rangeFromNumber.trim() && !rangeFromChapter)}
                    />
                  </label>
                  <label className="novel-download-sheet__range-field">
                    <span>{t("downloads.novel.rangeTo")}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rangeToNumber}
                      onChange={(event) => setRangeToNumber(event.target.value)}
                      disabled={busy}
                      placeholder={t("downloads.novel.rangeNumberPlaceholder")}
                      aria-label={t("downloads.novel.rangeTo")}
                      aria-invalid={Boolean(rangeToNumber.trim() && !rangeToChapter)}
                    />
                  </label>
                </div>
                <p className={`novel-download-sheet__range-summary${rangeError ? " is-error" : ""}`}>
                  {rangeError
                    ? rangeError
                    : selectedRangeChapters.length
                      ? t("downloads.novel.rangeSelected", { count: selectedRangeChapters.length })
                        + (rangeFromChapter && rangeToChapter
                          ? ` · ${chapterRangeOptionLabel(rangeFromChapter)} → ${chapterRangeOptionLabel(rangeToChapter)}`
                          : "")
                      : t("downloads.novel.rangeEnterNumbers")}
                </p>
                <button
                  type="button"
                  className="novel-download-sheet__action novel-download-sheet__action--range"
                  disabled={!canDownloadRange}
                  onClick={() => onDownloadRange?.(selectedRangeChapters)}
                >
                  <ListOrdered size={18} aria-hidden="true" />
                  <span>
                    <strong>{t("downloads.novel.downloadRange")}</strong>
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
                <strong>{t("downloads.novel.downloadAll")}</strong>
                <small>{allHint}</small>
              </span>
            </button>
          </div>
        </section>
      </div>
    </SheetPortal>
  );
}
