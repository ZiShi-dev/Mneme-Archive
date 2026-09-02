import React from "react";
import { Check } from "lucide-react";
import { SheetCloseButton } from "../../../components/ui/SheetCloseButton";
import { SheetPortal } from "../../../components/ui/SheetPortal";
import { useI18n } from "../../../i18n/I18nProvider";

export function VideoServerSheet({
  open,
  onClose,
  serverLabels,
  activeIndex,
  embedOnlyServer = false,
  loading = false,
  onSelect,
}) {
  const { t, dir } = useI18n();

  if (!open) return null;

  return (
    <SheetPortal>
      <div
        className="reader-settings-backdrop video-server-sheet-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onTouchStart={(event) => {
          event.stopPropagation();
        }}
      >
        <section
          className="reader-settings video-server-sheet reader-settings--theme-night"
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-server-sheet-title"
          dir={dir}
          onTouchStart={(event) => event.stopPropagation()}
        >
          <header>
            <div>
              <small>{t("reader.stream.serversAria")}</small>
              <h2 id="video-server-sheet-title">{t("reader.stream.chooseServer")}</h2>
            </div>
            <SheetCloseButton onClick={onClose} label={t("common.close")} />
          </header>

          <div className="reader-settings__body video-server-sheet__body">
            {loading ? (
              <p className="video-server-sheet__loading" role="status">
                {t("reader.stream.loading")}
              </p>
            ) : (
              <div className="video-server-sheet__chips" role="list">
                {serverLabels.map((label, index) => {
                  const active = index === activeIndex;
                  return (
                    <button
                      key={`${label}-${index}`}
                      type="button"
                      role="listitem"
                      className={`video-server-sheet__chip${active ? " active" : ""}`}
                      onClick={() => onSelect(index)}
                      aria-pressed={active}
                      aria-label={label}
                    >
                      <span dir="ltr">{label}</span>
                      {active ? <Check size={16} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            )}
            {!loading && embedOnlyServer ? (
              <p className="video-server-sheet__hint">{t("reader.stream.embedHint")}</p>
            ) : null}
          </div>
        </section>
      </div>
    </SheetPortal>
  );
}
