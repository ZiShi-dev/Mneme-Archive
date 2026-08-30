import React, { useEffect } from "react";
import { Check, ChevronLeft, Languages } from "lucide-react";
import { SheetCloseButton } from "../components/ui/SheetCloseButton";
import { SheetPortal } from "../components/ui/SheetPortal";
import { useToast } from "../components/ui/ToastProvider";
import { useI18n } from "../i18n/I18nProvider";
import { t as runtimeT } from "../i18n/runtime";

export function LanguageSettingsEntry({ onOpen }) {
  const { t, locale, locales } = useI18n();
  return (
    <button type="button" className="setting-row" onClick={onOpen}>
      <span className="setting-row__icon"><Languages size={19} /></span>
      <span className="setting-row__copy">
        <strong>{t("settings.language")}</strong>
        <small>{locales[locale]?.nativeName}</small>
      </span>
      <ChevronLeft size={18} />
    </button>
  );
}

export function LanguageSettingsSheet({ open, onClose }) {
  const { t, locale, setLocale, locales } = useI18n();
  const { pushToast } = useToast();

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
        aria-labelledby="language-sheet-title"
      >
        <header>
          <div>
            <small>{t("settings.display")}</small>
            <h2 id="language-sheet-title">{t("settings.language")}</h2>
          </div>
          <SheetCloseButton onClick={onClose} />
        </header>

        <div className="notify-sheet__body">
          <div className="theme-selector" role="group" aria-label={t("settings.language")}>
            {Object.values(locales).map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={locale === entry.id ? "active" : ""}
                aria-pressed={locale === entry.id}
                onClick={() => {
                  setLocale(entry.id);
                  const toastKey = entry.id === "fr"
                    ? "toast.languageFr"
                    : entry.id === "en"
                      ? "toast.languageEn"
                      : "toast.languageAr";
                  pushToast({
                    type: "success",
                    message: runtimeT(toastKey),
                  });
                  onClose();
                }}
              >
                <Languages size={19} />
                <span>
                  <strong>{entry.nativeName}</strong>
                  <small>{entry.id === "ar" ? t("settings.languageArHint") : entry.id === "en" ? t("settings.languageEnHint") : t("settings.languageFrHint")}</small>
                </span>
                <Check size={16} />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
    </SheetPortal>
  );
}
