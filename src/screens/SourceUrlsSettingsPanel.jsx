import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Link2, RotateCcw } from "lucide-react";
import { SheetCloseButton } from "../components/ui/SheetCloseButton";
import { SheetPortal } from "../components/ui/SheetPortal";
import { useI18n } from "../i18n/I18nProvider";
import { getSourceDisplayName, getSourceProfile } from "../config/sources";
import { SourceLogo } from "../features/sources/SourceLogo";
import { clearSourceApiCache } from "../features/sources/sourceApi";
import {
  getDefaultSourceBaseUrl,
  getEffectiveSourceBaseUrl,
  listConfigurableSourceIds,
  normalizeSourceBaseUrl,
} from "../lib/settings/sourceBaseUrls.js";

function SourceUrlEditorPanel({
  sourceId,
  currentUrl,
  onBack,
  onSave,
}) {
  const { t } = useI18n();
  const profile = getSourceProfile(sourceId);
  const defaultUrl = getDefaultSourceBaseUrl(sourceId);
  const [draft, setDraft] = useState(currentUrl);

  useEffect(() => {
    setDraft(currentUrl);
  }, [currentUrl, sourceId]);

  const normalizedDraft = normalizeSourceBaseUrl(sourceId, draft);
  const isCustom = normalizedDraft !== defaultUrl;

  const apply = () => {
    const next = normalizeSourceBaseUrl(sourceId, draft);
    if (next !== currentUrl) {
      clearSourceApiCache();
      onSave(next);
    }
    onBack();
  };

  return (
    <>
      <header>
        <button type="button" className="source-url-sheet__back" onClick={onBack} aria-label={t("common.back")}>
          <ChevronRight size={18} />
        </button>
        <div>
          <small>{getSourceDisplayName(profile)}</small>
          <h2 id="source-urls-sheet-title">{t("settings.sourceUrlEditTitle")}</h2>
        </div>
        <SheetCloseButton label={t("common.close")} onClick={onBack} />
      </header>
      <div className="notify-sheet__body">
        <p className="notify-sheet__hint">{t("settings.sourceUrlHint")}</p>
        <label className="coflix-url-field">
          <span className="coflix-url-field__label">{t("settings.sourceUrlLabel")}</span>
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
        <p className="notify-sheet__hint">{t("settings.sourceUrlPreview", { url: normalizedDraft })}</p>
        {!isCustom && (
          <p className="notify-sheet__hint">{t("settings.sourceUrlDefault", { url: defaultUrl })}</p>
        )}
        <div className="notify-sheet__tools">
          <button
            type="button"
            className="notify-sheet__tools-secondary"
            onClick={() => setDraft(defaultUrl)}
          >
            <RotateCcw size={16} />
            {t("settings.sourceUrlReset")}
          </button>
          <button type="button" className="notify-sheet__tools-primary" onClick={apply}>
            {t("common.done")}
          </button>
        </div>
      </div>
    </>
  );
}

export function SourceUrlsSettingsEntry({ overrideCount, onOpen }) {
  const { t } = useI18n();
  return (
    <button type="button" className="setting-row" onClick={onOpen}>
      <span className="setting-row__icon"><Link2 size={19} /></span>
      <span className="setting-row__copy">
        <strong>{t("settings.sourceUrls")}</strong>
        <small>
          {overrideCount
            ? t("settings.sourceUrlsCustom", { count: overrideCount })
            : t("settings.sourceUrlsHint")}
        </small>
      </span>
      <ChevronLeft size={18} />
    </button>
  );
}

export function SourceUrlsSettingsSheet({
  open,
  onClose,
  sourceBaseUrls,
  onSaveOverride,
}) {
  const { t } = useI18n();
  const [editingId, setEditingId] = useState(null);

  const sourceIds = useMemo(() => listConfigurableSourceIds(), []);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      if (editingId) setEditingId(null);
      else onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, editingId, onClose]);

  if (!open) return null;

  const editingUrl = editingId
    ? getEffectiveSourceBaseUrl(editingId, sourceBaseUrls)
    : "";

  const handleBackdropClose = () => {
    if (editingId) setEditingId(null);
    else onClose();
  };

  return (
    <SheetPortal>
      <div
        className="notify-sheet-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) handleBackdropClose();
        }}
      >
        <section
          className="notify-sheet theme-sheet source-urls-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="source-urls-sheet-title"
        >
          {editingId ? (
            <SourceUrlEditorPanel
              sourceId={editingId}
              currentUrl={editingUrl}
              onBack={() => setEditingId(null)}
              onSave={(nextUrl) => onSaveOverride(editingId, nextUrl)}
            />
          ) : (
            <>
              <header>
                <div>
                  <small>{t("settings.sourceUrlsEyebrow")}</small>
                  <h2 id="source-urls-sheet-title">{t("settings.sourceUrls")}</h2>
                </div>
                <SheetCloseButton label={t("common.close")} onClick={onClose} />
              </header>
              <div className="notify-sheet__body source-urls-sheet__body">
                <p className="notify-sheet__hint">{t("settings.sourceUrlsSheetHint")}</p>
                <div className="source-url-list" role="list">
                  {sourceIds.map((sourceId) => {
                    const profile = getSourceProfile(sourceId);
                    const effectiveUrl = getEffectiveSourceBaseUrl(sourceId, sourceBaseUrls);
                    const defaultUrl = getDefaultSourceBaseUrl(sourceId);
                    const isCustom = effectiveUrl !== defaultUrl;
                    return (
                      <button
                        key={sourceId}
                        type="button"
                        className="source-url-list__row"
                        role="listitem"
                        onClick={() => setEditingId(sourceId)}
                      >
                        <SourceLogo sourceId={sourceId} />
                        <span className="source-url-list__copy">
                          <strong>{getSourceDisplayName(profile)}</strong>
                          <small dir="ltr">{effectiveUrl}</small>
                          {isCustom && <em>{t("settings.sourceUrlCustomBadge")}</em>}
                        </span>
                        <ChevronLeft size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </SheetPortal>
  );
}
