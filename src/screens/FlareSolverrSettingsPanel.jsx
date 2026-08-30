import React, { useEffect, useState } from "react";
import { ChevronLeft, RotateCcw, Shield } from "lucide-react";
import { SheetCloseButton } from "../components/ui/SheetCloseButton";
import { SheetPortal } from "../components/ui/SheetPortal";
import { useI18n } from "../i18n/I18nProvider";
import { getDefaultFlareSolverrUrl, normalizeFlareSolverrUrl } from "../lib/settings/flareSolverrUrl.js";
import { clearSourceApiCache } from "../features/sources/sourceApi";

export function FlareSolverrSettingsEntry({ baseUrl, onOpen }) {
  const { t } = useI18n();
  const configured = Boolean(baseUrl);
  return (
    <button type="button" className="setting-row" onClick={onOpen}>
      <span className="setting-row__icon"><Shield size={19} /></span>
      <span className="setting-row__copy">
        <strong>{t("settings.flareSolverrUrl")}</strong>
        <small>{configured ? baseUrl : t("settings.flareSolverrUrlDisabled")}</small>
      </span>
      <ChevronLeft size={18} />
    </button>
  );
}

export function FlareSolverrSettingsSheet({ open, onClose, baseUrl, onSave }) {
  const { t } = useI18n();
  const defaultUrl = getDefaultFlareSolverrUrl();
  const [draft, setDraft] = useState(baseUrl || defaultUrl);

  useEffect(() => {
    if (!open) return undefined;
    setDraft(baseUrl || defaultUrl);
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
  }, [open, baseUrl, defaultUrl, onClose]);

  if (!open) return null;

  const normalizedDraft = normalizeFlareSolverrUrl(draft, { fallback: defaultUrl });

  const apply = () => {
    const next = normalizeFlareSolverrUrl(draft, { fallback: defaultUrl });
    if (next !== baseUrl) {
      clearSourceApiCache();
      onSave(next);
    }
    onClose();
  };

  const reset = () => {
    setDraft(defaultUrl);
  };

  return (
    <SheetPortal>
      <div
        className="notify-sheet-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section className="notify-sheet theme-sheet coflix-settings-sheet" role="dialog" aria-modal="true" aria-labelledby="flare-solverr-settings-title">
          <header>
            <div>
              <small>{t("settings.flareSolverrUrlEyebrow")}</small>
              <h2 id="flare-solverr-settings-title">{t("settings.flareSolverrUrl")}</h2>
            </div>
            <SheetCloseButton label={t("common.close")} onClick={onClose} />
          </header>
          <div className="notify-sheet__body">
            <p className="notify-sheet__hint">{t("settings.flareSolverrUrlHint")}</p>
            <label className="coflix-url-field">
              <span className="coflix-url-field__label">{t("settings.flareSolverrUrlLabel")}</span>
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder={defaultUrl}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            <p className="notify-sheet__hint">
              {t("settings.flareSolverrUrlPreview", { url: normalizedDraft })}
            </p>
            <div className="notify-sheet__tools">
              <button type="button" className="notify-sheet__tools-secondary" onClick={reset}>
                <RotateCcw size={16} />
                {t("settings.flareSolverrUrlReset")}
              </button>
              <button type="button" className="notify-sheet__tools-primary" onClick={apply}>
                {t("common.done")}
              </button>
            </div>
          </div>
        </section>
      </div>
    </SheetPortal>
  );
}
