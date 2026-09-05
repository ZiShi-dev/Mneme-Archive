import React, { useEffect } from "react";
import { Download, HardDrive, Wifi } from "lucide-react";
import { SheetCloseButton } from "../../../components/ui/SheetCloseButton";
import { SheetPortal } from "../../../components/ui/SheetPortal";
import { useI18n } from "../../../i18n/I18nProvider";
import { formatBytes, formatDataUsage } from "../../../lib/downloads/formatBytes";

export function NovelDownloadConfirmDialog({
  open,
  mode = "chapter",
  estimate,
  rangeSummary = "",
  onConfirm,
  onCancel,
}) {
  const { t, locale, dir } = useI18n();

  useEffect(() => {
    if (!open) return undefined;
    const onEscape = (event) => {
      if (event.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open, onCancel]);

  if (!open || !estimate) return null;

  const title = mode === "all"
    ? t("downloads.novel.confirmTitleAll")
    : mode === "range"
      ? t("downloads.novel.confirmTitleRange")
      : t("downloads.novel.confirmTitleChapter");

  return (
    <SheetPortal>
      <div className="modal-backdrop" onClick={onCancel} role="presentation">
        <section
          className="modal confirm-dialog confirm-dialog--download novel-download-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="novel-download-confirm-title"
          aria-describedby="novel-download-confirm-description"
          dir={dir}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal__head">
            <span className="confirm-dialog__icon confirm-dialog__icon--download" aria-hidden="true">
              <Download size={20} />
            </span>
            <SheetCloseButton onClick={onCancel} />
          </div>
          <h2 id="novel-download-confirm-title">{title}</h2>
          <div id="novel-download-confirm-description" className="novel-download-confirm__stats">
            {mode === "all" || mode === "range" ? (
              <p className="novel-download-confirm__summary">
                {mode === "range" && rangeSummary
                  ? rangeSummary
                  : t("downloads.novel.confirmChapters", { count: estimate.pendingCount })}
              </p>
            ) : null}
            <div className="novel-download-confirm__row">
              <HardDrive size={16} aria-hidden="true" />
              <span className="novel-download-confirm__row-copy">
                <span className="novel-download-confirm__row-label">{t("downloads.novel.confirmStorageLabel")}</span>
                <strong className="novel-download-confirm__row-value">{formatBytes(estimate.storageBytes, locale)}</strong>
              </span>
            </div>
            <div className="novel-download-confirm__row">
              <Wifi size={16} aria-hidden="true" />
              <span className="novel-download-confirm__row-copy">
                <span className="novel-download-confirm__row-label">{t("downloads.novel.confirmDataLabel")}</span>
                <strong className="novel-download-confirm__row-value">{formatDataUsage(estimate.dataBytes, locale)}</strong>
              </span>
            </div>
            {!estimate.precise ? (
              <p className="novel-download-confirm__note">{t("downloads.novel.confirmApproximate")}</p>
            ) : null}
          </div>
          <div className="confirm-dialog__actions">
            <button type="button" className="confirm-dialog__cancel" onClick={onCancel}>
              {t("common.cancel")}
            </button>
            <button type="button" className="confirm-dialog__confirm" onClick={onConfirm}>
              {t("downloads.novel.confirmDownload")}
            </button>
          </div>
        </section>
      </div>
    </SheetPortal>
  );
}
