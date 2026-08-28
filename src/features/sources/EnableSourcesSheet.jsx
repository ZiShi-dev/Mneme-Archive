import React, { useEffect, useMemo, useState } from "react";
import { Globe2, Languages, Power, Search } from "lucide-react";
import { useToast } from "../../components/ui/ToastProvider";
import { AccessibleSearchField } from "../../components/ui/AccessibleSearchField";
import { ChipFilterBar, ChipFilterButton } from "../../components/ui/ChipFilterBar";
import { SheetCloseButton } from "../../components/ui/SheetCloseButton";
import { SheetPortal } from "../../components/ui/SheetPortal";
import { getSourceProfile, initialSourcePreferences } from "../../config/sources";
import { useI18n } from "../../i18n/I18nProvider";
import { contentTypes } from "./contentTypes";
import {
  collectSourceLanguages,
  filterEnableSources,
  isSourceEnabled,
  languageFilterLabel,
  wouldLeaveNoEnabledSource,
} from "./enableSources";
import { SourceLanguageChips } from "./SourceLanguageChips";
import { SourceLogo } from "./SourceLogo";

export function EnableSourcesSheet({
  open,
  sources,
  sourcePreferences,
  onClose,
  onToggleSite,
  onSetSitesEnabled,
}) {
  const { pushToast } = useToast();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [language, setLanguage] = useState("all");
  const [scope, setScope] = useState("all");

  useEffect(() => {
    if (open) return undefined;
    setQuery("");
    setType("all");
    setLanguage("all");
    setScope("all");
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  const activeCount = useMemo(() => sources.filter(isSourceEnabled).length, [sources]);
  const languages = useMemo(() => collectSourceLanguages(sources), [sources]);

  const typeCounts = useMemo(() => {
    const counts = { all: sources.length };
    for (const key of Object.keys(contentTypes)) {
      if (key === "all") continue;
      counts[key] = sources.filter((entry) => (getSourceProfile(entry.id).contentTypes || ["manga"]).includes(key)).length;
    }
    return counts;
  }, [sources]);

  const languageCounts = useMemo(() => {
    const counts = { all: sources.length };
    for (const code of languages) {
      counts[code] = filterEnableSources(sources, { language: code }).length;
    }
    return counts;
  }, [languages, sources]);

  const matchedSources = useMemo(
    () => filterEnableSources(sources, { query, type, language, scope: "all" }),
    [language, query, sources, type],
  );

  const scopeCounts = useMemo(() => ({
    all: matchedSources.length,
    enabled: matchedSources.filter(isSourceEnabled).length,
    disabled: matchedSources.filter((entry) => !isSourceEnabled(entry)).length,
  }), [matchedSources]);

  const visibleSources = useMemo(
    () => filterEnableSources(matchedSources, { scope }),
    [matchedSources, scope],
  );

  const visibleDisabledIds = visibleSources.filter((entry) => !isSourceEnabled(entry)).map((entry) => entry.id);
  const visibleEnabledIds = visibleSources.filter(isSourceEnabled).map((entry) => entry.id);
  const hasFilters = Boolean(query.trim()) || type !== "all" || language !== "all" || scope !== "all";

  const toggleSource = (id) => {
    if (wouldLeaveNoEnabledSource(sources, id)) {
      pushToast({ type: "info", message: t("sources.keepOne") });
      return;
    }
    onToggleSite(id);
  };

  const enableVisible = () => {
    if (!visibleDisabledIds.length || !onSetSitesEnabled) return;
    onSetSitesEnabled(visibleDisabledIds, true);
  };

  const disableVisible = () => {
    if (!visibleEnabledIds.length || !onSetSitesEnabled) return;
    onSetSitesEnabled(visibleEnabledIds, false);
  };

  const clearFilters = () => {
    setQuery("");
    setType("all");
    setLanguage("all");
    setScope("all");
  };

  if (!open) return null;

  return (
    <SheetPortal>
    <div
      className="management-source-picker-backdrop"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="management-source-picker" role="dialog" aria-modal="true" aria-labelledby="management-source-picker-title">
        <header className="management-source-picker__header">
          <div className="management-source-picker__title">
            <span className="management-source-picker__badge" aria-hidden="true"><Globe2 size={15} /></span>
            <div>
              <small>{t("sources.enabledOfTotal", { enabled: activeCount, total: sources.length })}</small>
              <h2 id="management-source-picker-title">{t("sources.enableTitle")}</h2>
            </div>
          </div>
          <SheetCloseButton onClick={onClose} />
        </header>

        <p className="management-source-picker__hint">{t("sources.enableHint")}</p>

        <ChipFilterBar variant="segmented" role="tablist" ariaLabel={t("sources.viewAria")} className="management-source-picker__tabs">
          {[
            { id: "all", label: t("common.all"), count: scopeCounts.all },
            { id: "enabled", label: t("sources.enabled"), count: scopeCounts.enabled },
            { id: "disabled", label: t("sources.disabled"), count: scopeCounts.disabled },
          ].map((tab) => (
            <ChipFilterButton
              key={tab.id}
              type="button"
              role="tab"
              active={scope === tab.id}
              ariaSelected={scope === tab.id}
              count={tab.count}
              onClick={() => setScope(tab.id)}
            >
              {tab.label}
            </ChipFilterButton>
          ))}
        </ChipFilterBar>

        <AccessibleSearchField
          className="global-search management-source-picker__search"
          value={query}
          onChange={setQuery}
          placeholder={t("sources.searchPlaceholder")}
          ariaLabel={t("sources.searchAria")}
          autoFocus
        />

        <ChipFilterBar
          label={t("sources.typeFilter")}
          role="group"
          ariaLabel={t("sources.typeFilterAria")}
          className="management-source-picker__filter"
          showClear={type !== "all"}
          onClear={() => setType("all")}
        >
          {Object.entries(contentTypes)
            .filter(([key]) => key === "all" || (typeCounts[key] ?? 0) > 0)
            .map(([key, meta]) => (
              <ChipFilterButton
                key={key}
                active={type === key}
                icon={meta.icon}
                count={key !== "all" ? (typeCounts[key] ?? 0) : undefined}
                onClick={() => setType(key)}
              >
                {meta.label}
              </ChipFilterButton>
            ))}
        </ChipFilterBar>

        {languages.length > 1 && (
          <ChipFilterBar
            label={t("sources.languageFilter")}
            role="group"
            ariaLabel={t("sources.languageFilterAria")}
            className="management-source-picker__filter"
            showClear={language !== "all"}
            onClear={() => setLanguage("all")}
          >
            <ChipFilterButton active={language === "all"} icon={Languages} onClick={() => setLanguage("all")}>
              {t("common.all")}
            </ChipFilterButton>
            {languages.map((code) => (
              <ChipFilterButton
                key={code}
                active={language === code}
                count={languageCounts[code]}
                onClick={() => setLanguage(code)}
              >
                {languageFilterLabel(code)}
              </ChipFilterButton>
            ))}
          </ChipFilterBar>
        )}

        <div className="management-source-picker__list" role="list">
          {visibleSources.map((entry) => {
            const profile = getSourceProfile(entry.id);
            const preference = { ...initialSourcePreferences[entry.id], ...sourcePreferences?.[entry.id] };
            const count = preference.selectedItems?.length || 0;
            const enabled = isSourceEnabled(entry);
            return (
              <button
                key={entry.id}
                type="button"
                role="switch"
                aria-checked={enabled}
                className={`management-source-picker__row${enabled ? " active" : ""}`}
                onClick={() => toggleSource(entry.id)}
              >
                <SourceLogo sourceId={entry.id} />
                <span className="management-source-picker__row-copy">
                  <strong>{profile.name}</strong>
                  <small dir="ltr">{profile.domain}</small>
                  <span className="management-source-picker__row-meta">
                    {(profile.contentTypes || ["manga"]).map((contentType) => (
                      <span key={contentType}>{contentTypes[contentType]?.label || contentType}</span>
                    ))}
                    <SourceLanguageChips profile={profile} />
                    <i>{preference.mode === "full" ? t("sources.fullCatalog") : t("sources.selectedCount", { count })}</i>
                  </span>
                </span>
                <span className={`management-source-picker__switch${enabled ? " on" : ""}`} aria-hidden="true"><i /></span>
              </button>
            );
          })}

          {!visibleSources.length && (
            <div className="management-source-picker__empty">
              <Search size={22} aria-hidden="true" />
              <p>{t("sources.noMatch")}</p>
              {hasFilters && (
                <button type="button" className="management-source-picker__empty-clear" onClick={clearFilters}>
                  {t("common.clearFilter")}
                </button>
              )}
            </div>
          )}
        </div>

        <footer className="management-source-picker__footer">
          <span>{t("sources.shownEnabled", { shown: visibleSources.length, enabled: activeCount })}</span>
          <div className="management-source-picker__actions">
            {onSetSitesEnabled && visibleDisabledIds.length > 0 && (
              <button type="button" className="management-source-picker__bulk" onClick={enableVisible}>
                <Power size={12} aria-hidden="true" />
                {t("sources.enableVisible")}
              </button>
            )}
            {onSetSitesEnabled && visibleEnabledIds.length > 0 && activeCount > 1 && (
              <button type="button" className="management-source-picker__bulk" onClick={disableVisible}>
                {t("sources.disableVisible")}
              </button>
            )}
            <button type="button" className="button button--primary management-source-picker__done" onClick={onClose}>{t("common.done")}</button>
          </div>
        </footer>
      </section>
    </div>
    </SheetPortal>
  );
}
