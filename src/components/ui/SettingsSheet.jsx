import React from "react";
import { SheetCloseButton } from "./SheetCloseButton";
import { SheetPortal } from "./SheetPortal";
import { useSheetLock } from "../../hooks/useSheetLock";

export function SettingsSheet({
  open,
  onClose,
  title,
  eyebrow,
  titleId,
  className = "",
  closeLabel,
  children,
  footer = null,
}) {
  useSheetLock(open, onClose);

  if (!open) return null;

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
          className={["notify-sheet", className].filter(Boolean).join(" ")}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="notify-sheet__handle" aria-hidden="true" />
          <header>
            <div>
              {eyebrow ? <small>{eyebrow}</small> : null}
              <h2 id={titleId}>{title}</h2>
            </div>
            <SheetCloseButton onClick={onClose} label={closeLabel} />
          </header>
          <div className="notify-sheet__body">{children}</div>
          {footer ? <footer>{footer}</footer> : null}
        </section>
      </div>
    </SheetPortal>
  );
}
