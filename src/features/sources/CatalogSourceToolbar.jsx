import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Globe2, Search, Settings2 } from "lucide-react";
import { getSourceLanguageLabels, getSourceProfile } from "../../config/sources";
import { useI18n } from "../../i18n/I18nProvider";
import { AccessibleSearchField } from "../../components/ui/AccessibleSearchField";
import { ChipFilterBar, ChipFilterButton } from "../../components/ui/ChipFilterBar";
import { SheetCloseButton } from "../../components/ui/SheetCloseButton";
import { SheetPortal } from "../../components/ui/SheetPortal";
import { contentTypes } from "./contentTypes";
import { SourceLanguageChips } from "./SourceLanguageChips";
import { SourceLogo } from "./SourceLogo";

const INLINE_SOURCE_LIMIT = 4;

const CatalogSourcePickerOption = memo(function CatalogSourcePickerOption({
  entry,
  isActive,
  disabled,
  onSelect,
  stoppedLabel,
}) {
  const entryProfile = getSourceProfile(entry.id);
  return (
    <button
      type="button"
      className={`catalog-source-picker__option${isActive ? " active" : ""}${disabled ? " disabled" : ""}`}
      disabled={disabled}
      onClick={() => onSelect(entry.id)}
    >
      <SourceLogo sourceId={entry.id} />
      <span>
        <strong dir="ltr">{entryProfile.name}</strong>
        <small>{disabled ? stoppedLabel : entryProfile.contentLabel}</small>
        {!disabled && <SourceLanguageChips profile={entryProfile} />}
      </span>
      {isActive && <Check size={14} aria-hidden="true" />}
    </button>
  );
});

export function CatalogSourceToolbar({ sources, activeSourceId, onSetActiveSource, onOpenSettings }) {
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMounted, setPickerMounted] = useState(false);
  const [pickerReady, setPickerReady] = useState(false);
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceType, setSourceType] = useState("all");
  const pickerReadyOnce = useRef(false);
  const activeSource = sources.find((entry) => entry.id === activeSourceId) || sources[0];
  const activeProfile = getSourceProfile(activeSource?.id);
  const compactMode = sources.length > INLINE_SOURCE_LIMIT;
  const stoppedLabel = t("sources.stopped");

  const sourceTypeCounts = useMemo(() => {
    const counts = { all: sources.length };
    for (const type of Object.keys(contentTypes)) {
      if (type === "all") continue;
      counts[type] = sources.filter((entry) => (getSourceProfile(entry.id).contentTypes || ["manga"]).includes(type)).length;
    }
    return counts;
  }, [sources]);

  const filteredSources = useMemo(() => {
    const normalized = sourceQuery.trim().toLowerCase();
    return sources.filter((entry) => {
      const profile = getSourceProfile(entry.id);
      const matchesType = sourceType === "all" || (profile.contentTypes || ["manga"]).includes(sourceType);
      const matchesQuery = !normalized || [profile.name, profile.arabicName, profile.domain, ...getSourceLanguageLabels(profile)].some((value) => String(value).toLowerCase().includes(normalized));
      return matchesType && matchesQuery;
    });
  }, [sourceQuery, sourceType, sources]);

  const openPicker = useCallback(() => {
    setPickerMounted(true);
    setPickerOpen(true);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    if (pickerReadyOnce.current) {
      setPickerReady(true);
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      pickerReadyOnce.current = true;
      setPickerReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setPickerOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [pickerOpen]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setSourceQuery("");
    setSourceType("all");
  }, []);

  const selectSource = useCallback((sourceId) => {
    onSetActiveSource(sourceId);
    closePicker();
  }, [closePicker, onSetActiveSource]);

  const inlineSources = compactMode
    ? sources.filter((entry) => entry.id === activeSource?.id)
    : sources;

  return (
    <>
      <section className="catalog-source-toolbar" aria-label={t("sources.toolbar")}>
        <span className="catalog-source-toolbar__label">{t("sources.label")}</span>
        <div className="catalog-source-toolbar__chips">
          {inlineSources.map((entry) => {
            const entryProfile = getSourceProfile(entry.id);
            const disabled = entry.enabled === false;
            const isActive = activeSource?.id === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                className={`catalog-source-toolbar__chip${isActive ? " active" : ""}${disabled ? " disabled" : ""}`}
                disabled={disabled}
                aria-pressed={isActive}
                onClick={() => (compactMode ? openPicker() : onSetActiveSource(entry.id))}
              >
                <SourceLogo sourceId={entry.id} />
                <span>{entryProfile.name}</span>
              </button>
            );
          })}
          {compactMode && (
            <button type="button" className="catalog-source-toolbar__more" onClick={openPicker}>
              <Globe2 size={12} aria-hidden="true" />
              <span>{t("sources.all")}</span>
              <small>{sources.length}</small>
            </button>
          )}
        </div>
        <button type="button" className="catalog-source-toolbar__settings" onClick={onOpenSettings} aria-label={t("sources.settings")}>
          <Settings2 size={15} />
        </button>
      </section>

      {pickerMounted && (
        <SheetPortal>
          <div
            className={`catalog-source-picker-backdrop${pickerOpen ? " is-open" : " is-closed"}`}
            onMouseDown={(event) => { if (event.target === event.currentTarget) closePicker(); }}
            aria-hidden={!pickerOpen}
          >
            <section
              className="catalog-source-picker"
              role="dialog"
              aria-modal={pickerOpen}
              aria-hidden={!pickerOpen}
              aria-labelledby="catalog-source-picker-title"
            >
              <header className="catalog-source-picker__header">
                <div className="catalog-source-picker__title">
                  <span className="catalog-source-picker__badge" aria-hidden="true"><Globe2 size={15} /></span>
                  <div>
                    <small>{t("sources.count", { count: sources.length })}</small>
                    <h2 id="catalog-source-picker-title">{t("sources.pick")}</h2>
                  </div>
                </div>
                <SheetCloseButton onClick={closePicker} />
              </header>

              {pickerOpen && pickerReady && (
                <>
                  <AccessibleSearchField
                    className="global-search catalog-source-picker__search"
                    value={sourceQuery}
                    onChange={setSourceQuery}
                    placeholder={t("sources.searchPlaceholder")}
                    ariaLabel={t("sources.searchAria")}
                  />

                  <ChipFilterBar
                    label={t("sources.typeFilter")}
                    role="group"
                    ariaLabel={t("sources.typeFilterAria")}
                    className="catalog-source-picker__filter"
                    showClear={sourceType !== "all"}
                    onClear={() => setSourceType("all")}
                  >
                    {Object.entries(contentTypes)
                      .filter(([type]) => type === "all" || (sourceTypeCounts[type] ?? 0) > 0)
                      .map(([type, meta]) => (
                        <ChipFilterButton
                          key={type}
                          active={sourceType === type}
                          icon={meta.icon}
                          count={type !== "all" ? (sourceTypeCounts[type] ?? 0) : undefined}
                          onClick={() => setSourceType(type)}
                        >
                          {meta.label}
                        </ChipFilterButton>
                      ))}
                  </ChipFilterBar>

                  <div className="catalog-source-picker__list">
                    {filteredSources.map((entry) => (
                      <CatalogSourcePickerOption
                        key={entry.id}
                        entry={entry}
                        isActive={activeSource?.id === entry.id}
                        disabled={entry.enabled === false}
                        onSelect={selectSource}
                        stoppedLabel={stoppedLabel}
                      />
                    ))}

                    {!filteredSources.length && (
                      <div className="catalog-source-picker__empty">
                        <Search size={22} aria-hidden="true" />
                        <p>{t("sources.noMatch")}</p>
                      </div>
                    )}
                  </div>

                  <footer className="catalog-source-picker__footer">
                    <span>{t("sources.results", { count: filteredSources.length })}</span>
                    <span>{activeProfile.name}</span>
                  </footer>
                </>
              )}

              {pickerOpen && !pickerReady && (
                <div className="catalog-source-picker__list catalog-source-picker__list--pending" aria-hidden="true">
                  {sources.slice(0, 4).map((entry) => (
                    <div key={entry.id} className="catalog-source-picker__option catalog-source-picker__option--skeleton" />
                  ))}
                </div>
              )}
            </section>
          </div>
        </SheetPortal>
      )}
    </>
  );
}
