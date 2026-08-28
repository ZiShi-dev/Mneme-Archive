import React, { useEffect } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { SheetCloseButton } from "./SheetCloseButton";
import { SheetPortal } from "./SheetPortal";
import { t } from "../../i18n/runtime";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = t("common.confirm"),
  cancelLabel = t("common.cancel"),
  tone = "danger",
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onEscape = (event) => {
      if (event.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <SheetPortal>
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <section
        className={`modal confirm-dialog confirm-dialog--${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <span className={`confirm-dialog__icon confirm-dialog__icon--${tone}`} aria-hidden="true">
            {tone === "danger" ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
          </span>
          <SheetCloseButton onClick={onCancel} />
        </div>
        <h2 id="confirm-dialog-title">{title}</h2>
        {description && <p id="confirm-dialog-description">{description}</p>}
        <div className="confirm-dialog__actions">
          <button type="button" className="confirm-dialog__cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="confirm-dialog__confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
    </SheetPortal>
  );
}
