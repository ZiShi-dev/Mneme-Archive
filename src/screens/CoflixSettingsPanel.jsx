import React, { useEffect, useState } from "react";
import { ChevronLeft, Link2, RotateCcw } from "lucide-react";
import { SheetCloseButton } from "../components/ui/SheetCloseButton";
import { SheetPortal } from "../components/ui/SheetPortal";
import { useI18n } from "../i18n/I18nProvider";
import { DEFAULT_COFLEX_BASE_URL, normalizeCoflixBaseUrl } from "../lib/settings/coflixBaseUrl.js";
import { clearSourceApiCache } from "../features/sources/sourceApi";

export function CoflixSettingsEntry({ baseUrl, onOpen }) {
  const { t } = useI18n();
  return (
    <button type="button" className="setting-row" onClick={onOpen}>
      <span className="setting-row__icon"><Link2 size={19} /></span>
      <span className="setting-row__copy">
        <strong>{t("settings.coflixUrl")}</strong>
        <small>{baseUrl}</small>
      </span>
      <ChevronLeft size={18} />
    </button>
  );
}

export function CoflixSettingsSheet({ open, onClose, baseUrl, onSave }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(baseUrl);

  useEffect(() => {
    if (!open) return undefined;
    setDraft(baseUrl);
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
  }, [open, baseUrl, onClose]);

  if (!open) return null;

  const normalizedDraft = normalizeCoflixBaseUrl(draft);

  const apply = () => {
    const next = normalizeCoflixBaseUrl(draft);
    if (next !== baseUrl) {
      clearSourceApiCache();
      onSave(next);
    }
    onClose();
  };

  const reset = () => {
    setDraft(DEFAULT_COFLEX_BASE_URL);
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
        <section className="notify-sheet theme-sheet coflix-settings-sheet" role="dialog" aria-modal="true" aria-labelledby="coflix-settings-title">
          <header>
            <div>
              <small>{t("settings.coflixUrlEyebrow")}</small>
              <h2 id="coflix-settings-title">{t("settings.coflixUrl")}</h2>
            </div>
            <SheetCloseButton label={t("common.close")} onClick={onClose} />
          </header>
          <div className="notify-sheet__body">
            <p className="notify-sheet__hint">{t("settings.coflixUrlHint")}</p>
            <label className="coflix-url-field">
              <span className="coflix-url-field__label">{t("settings.coflixUrlLabel")}</span>
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder={DEFAULT_COFLEX_BASE_URL}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            <p className="notify-sheet__hint">{t("settings.coflixUrlPreview", { url: normalizedDraft })}</p>
            <div className="notify-sheet__tools">
              <button type="button" className="notify-sheet__tools-secondary" onClick={reset}>
                <RotateCcw size={16} />
                {t("settings.coflixUrlReset")}
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
