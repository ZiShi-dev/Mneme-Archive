import React, { useEffect } from "react";
import { ALargeSmall, BookOpen, Check, ChevronLeft, Type } from "lucide-react";
import { SheetCloseButton } from "../components/ui/SheetCloseButton";
import { SheetPortal } from "../components/ui/SheetPortal";
import { useI18n } from "../i18n/I18nProvider";
import {
  FONT_CLASSIC,
  FONT_KUFI,
  FONT_NASKH,
  FONT_SANS,
  TYPEFACES,
  typefaceHintKey,
  typefaceNameKey,
} from "../lib/theme/typeface";

const FONT_OPTIONS = [
  { id: FONT_SANS, Icon: Type },
  { id: FONT_NASKH, Icon: BookOpen },
  { id: FONT_KUFI, Icon: ALargeSmall },
  { id: FONT_CLASSIC, Icon: Type },
];

function FontSelector({ typeface, onSetTypeface }) {
  const { t } = useI18n();
  return (
    <div className="theme-selector theme-selector--four font-selector" role="group" aria-label={t("settings.font")}>
      {FONT_OPTIONS.map(({ id, Icon }) => {
        const active = typeface === id;
        return (
          <button
            key={id}
            type="button"
            className={active ? "active" : ""}
            aria-pressed={active}
            style={{ fontFamily: TYPEFACES[id].arabic }}
            onClick={() => onSetTypeface(id)}
          >
            <Icon size={19} />
            <span>
              <strong>{t(typefaceNameKey(id))}</strong>
              <small>{t(typefaceHintKey(id))}</small>
            </span>
            <Check size={16} />
          </button>
        );
      })}
    </div>
  );
}

export function FontSettingsSheet({ open, onClose, typeface, onSetTypeface }) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

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
        className="notify-sheet theme-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="font-sheet-title"
      >
        <header>
          <div>
            <small>{t("settings.appearance")}</small>
            <h2 id="font-sheet-title">{t("settings.pickFont")}</h2>
          </div>
          <SheetCloseButton onClick={onClose} label={t("settings.closeFont")} />
        </header>

        <div className="notify-sheet__body">
          <p className="notify-sheet__hint">{t("settings.fontHint")}</p>
          <FontSelector typeface={typeface} onSetTypeface={onSetTypeface} />
        </div>

        <footer>
          <button type="button" className="notify-sheet__done" onClick={onClose}>{t("common.done")}</button>
        </footer>
      </section>
    </div>
    </SheetPortal>
  );
}

export function FontSettingsEntry({ typeface, onOpen }) {
  const { t } = useI18n();
  return (
    <button type="button" className="setting-row" onClick={onOpen}>
      <span className="setting-row__icon"><Type size={19} /></span>
      <span className="setting-row__copy">
        <strong>{t("settings.font")}</strong>
        <small>{t(typefaceNameKey(typeface))} · {t(typefaceHintKey(typeface))}</small>
      </span>
      <ChevronLeft size={18} />
    </button>
  );
}
