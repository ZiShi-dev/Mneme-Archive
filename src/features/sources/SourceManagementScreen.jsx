import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Bookmark, Check, ChevronLeft, ChevronRight, Globe2, Plus, RefreshCw, Search, Settings2, Wifi, X } from "lucide-react";
import { useToast } from "../../components/ui/ToastProvider";
import { SourceHubOverview } from "./SourceHubOverview";
import { getSourceLanguageLabels, getSourceProfile, initialSourcePreferences } from "../../config/sources";
import { useI18n } from "../../i18n/I18nProvider";
import { Header } from "../../components/layout/Header";
import { contentTypes, getItemType } from "./contentTypes";
import { EnableSourcesSheet } from "./EnableSourcesSheet";
import { searchSource } from "./sourceApi";
import { RemoteCover } from "./RemoteCover";
import { SourceLanguageChips } from "./SourceLanguageChips";
import { SourceLogo } from "./SourceLogo";
import { SheetCloseButton } from "../../components/ui/SheetCloseButton";
import { SheetPortal } from "../../components/ui/SheetPortal";

const pickerPageSize = 4;

export function SourceManagementScreen({ sources, sourcePreferences, navigate, onBack, onToggleSite, onSetSitesEnabled, onSetSourceMode, onToggleSelection }) {
  const { pushToast } = useToast();
  const { t } = useI18n();
  const [managedSourceId, setManagedSourceId] = useState(sources[0]?.id || "mangalik");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [showConfig, setShowConfig] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [pickerView, setPickerView] = useState("selected");
  const [selectedQuery, setSelectedQuery] = useState("");
  const [pickerPage, setPickerPage] = useState(1);
  const source = sources.find((entry) => entry.id === managedSourceId) || sources[0];
  const profile = getSourceProfile(managedSourceId);
  const preference = { ...initialSourcePreferences[managedSourceId], ...sourcePreferences[managedSourceId] };
  const selectedItems = preference.selectedItems || [];
  const supportedTypes = profile.contentTypes || ["manga"];

  useEffect(() => {
    setQuery("");
    setResults([]);
    setStatus("idle");
    setMediaFilter("all");
    setPickerView("selected");
    setSelectedQuery("");
    setPickerPage(1);
  }, [managedSourceId]);

  useEffect(() => {
    if (preference.mode !== "selected" || pickerView !== "search" || query.trim().length < 2) {
      setResults([]);
      setStatus("idle");
      return undefined;
    }
    setStatus("loading");
    const timer = setTimeout(() => {
      searchSource(managedSourceId, query.trim())
        .then((data) => {
          const items = data.items || [];
          setResults(items);
          setStatus("ready");
          if (items.length) pushToast({ type: "success", message: t("sources.foundN", { count: items.length }) });
          else pushToast({ type: "info", message: t("sources.noMatches") });
        })
        .catch(() => {
          setResults([]);
          setStatus("error");
          pushToast({ type: "error", message: t("sources.searchFailed") });
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [query, preference.mode, managedSourceId, pickerView, pushToast, t]);

  const closeSourcePicker = () => setShowSourcePicker(false);

  const openSourceConfig = (sourceId) => {
    setManagedSourceId(sourceId);
    setShowConfig(true);
  };

  const enabledSources = useMemo(
    () => sources.filter((entry) => entry.enabled !== false),
    [sources],
  );

  useEffect(() => {
    if (!showConfig) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setShowConfig(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showConfig]);

  const displayedItems = useMemo(() => {
    const normalized = selectedQuery.trim().toLowerCase();
    const items = pickerView === "search" ? (query.trim().length >= 2 ? results : []) : selectedItems.filter((item) => !normalized || item.title.toLowerCase().includes(normalized));
    return mediaFilter === "all" ? items : items.filter((item) => getItemType(item) === mediaFilter);
  }, [mediaFilter, pickerView, query, results, selectedItems, selectedQuery]);

  const mediaFilterCounts = useMemo(() => {
    const base = pickerView === "search" ? (query.trim().length >= 2 ? results : []) : selectedItems;
    const counts = { all: base.length };
    for (const type of supportedTypes) counts[type] = base.filter((item) => getItemType(item) === type).length;
    return counts;
  }, [pickerView, query, results, selectedItems, supportedTypes]);

  const totalPickerPages = Math.max(1, Math.ceil(displayedItems.length / pickerPageSize));
  const pagedItems = displayedItems.slice((pickerPage - 1) * pickerPageSize, pickerPage * pickerPageSize);

  useEffect(() => {
    setPickerPage(1);
  }, [mediaFilter, pickerView, query, selectedQuery]);

  useEffect(() => {
    if (pickerPage > totalPickerPages) setPickerPage(totalPickerPages);
  }, [pickerPage, totalPickerPages]);
  const selectedUrls = useMemo(() => new Set(selectedItems.map((item) => item.url)), [selectedItems]);
  const selectedCounts = supportedTypes.reduce((counts, type) => ({ ...counts, [type]: selectedItems.filter((item) => getItemType(item) === type).length }), {});

  return (
    <div className="screen">
      <Header title={t("sources.manageTitle")} eyebrow={t("sources.manageEyebrow")} onBack={onBack} actions={false} />
      <main className="content source-management">
        <SourceHubOverview sources={sources} sourcePreferences={sourcePreferences} />

        <section className="source-directory" aria-labelledby="source-directory-title">
          <header className="source-directory__header">
            <div><span>{t("sources.directory")}</span><h2 id="source-directory-title">{t("sources.pickToManage")}</h2></div>
            <button type="button" className="source-directory__browse" onClick={() => setShowSourcePicker(true)}>
              <Globe2 size={13} aria-hidden="true" />
              <span>{t("sources.all")}</span>
              <strong>{sources.length}</strong>
            </button>
          </header>

          {enabledSources.length ? (
            <div className="source-directory__list">
              {enabledSources.map((entry) => {
                const entryProfile = getSourceProfile(entry.id);
                const entryPreference = { ...initialSourcePreferences[entry.id], ...sourcePreferences[entry.id] };
                const count = entryPreference.selectedItems?.length || 0;
                return (
                  <article className="source-directory-card active" key={entry.id}>
                    <div className="source-directory-card__top">
                      <SourceLogo sourceId={entry.id} />
                      <div className="source-directory-card__identity">
                        <strong>{entryProfile.name}</strong>
                        <small dir="ltr">{entryProfile.domain}</small>
                      </div>
                      <span className="source-directory-card__status">{t("common.active")}</span>
                    </div>
                    <div className="source-directory-card__types">
                      {(entryProfile.contentTypes || ["manga"]).map((type) => <span key={type}>{contentTypes[type]?.label || type}</span>)}
                      <SourceLanguageChips profile={entryProfile} />
                      <i>{entryPreference.mode === "full" ? t("sources.fullCatalog") : t("sources.selectedCount", { count })}</i>
                    </div>
                    <button type="button" className="source-directory-card__configure" onClick={() => openSourceConfig(entry.id)}>
                      <Settings2 size={15} />
                      <span>{t("sources.configure")}</span>
                      <ChevronLeft size={15} />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="source-directory__empty">
              <Globe2 size={25} aria-hidden="true" />
              <strong>{t("sources.noneEnabled")}</strong>
              <span>{t("sources.openAllToEnable")}</span>
              <button type="button" className="button button--primary" onClick={() => setShowSourcePicker(true)}>
                <Globe2 size={15} />
                {t("sources.enableTitle")}
              </button>
            </div>
          )}
        </section>

        <button className="button button--primary button--full" onClick={() => navigate("sources")}><BookOpen size={17} /> {t("sources.showSelected")}</button>
      </main>
      <EnableSourcesSheet
        open={showSourcePicker}
        sources={sources}
        sourcePreferences={sourcePreferences}
        onClose={closeSourcePicker}
        onToggleSite={onToggleSite}
        onSetSitesEnabled={onSetSitesEnabled}
      />

      {showConfig && <SheetPortal><div className="source-config-backdrop" onClick={() => setShowConfig(false)}>
        <section className="source-config-modal" role="dialog" aria-modal="true" aria-labelledby="source-config-title" onClick={(event) => event.stopPropagation()}>
          <div className="source-config-modal__bar"><SheetCloseButton onClick={() => setShowConfig(false)} label={t("sources.closeConfig")} /><span>{t("sources.configure")}</span><i /></div>
          <div className="source-config-modal__body">
            <section className="source-config-panel">
              <header className="source-config-panel__header"><SourceLogo sourceId={managedSourceId} /><div><span>{t("sources.sourceSettings")}</span><h2 id="source-config-title">{profile.name}</h2><small>{profile.contentLabel} · {getSourceLanguageLabels(profile).join(" · ")}</small></div><i className={source?.enabled === false ? "offline" : ""}>{source?.enabled === false ? t("common.stopped") : t("common.active")}</i></header>
              {source?.enabled === false ? <div className="source-config-disabled"><Wifi size={23} /><div><strong>{t("sources.sourceOffline")}</strong><span>{t("sources.sourceOfflineHint")}</span></div></div> : <>
                <div className="source-mode-cards">
                  <button className={preference.mode === "full" ? "active" : ""} onClick={() => onSetSourceMode(managedSourceId, "full")}><Globe2 size={21} /><span><strong>{t("sources.modeFull")}</strong><small>{t("sources.modeFullHint")}</small></span><Check size={18} /></button>
                  <button className={preference.mode === "selected" ? "active" : ""} onClick={() => onSetSourceMode(managedSourceId, "selected")}><Bookmark size={21} /><span><strong>{t("sources.modeSelected")}</strong><small>{t("sources.modeSelectedHint")}</small></span><Check size={18} /></button>
                </div>
                {preference.mode === "selected" && <section className="manga-picker">
                  <div className="selection-summary">{supportedTypes.map((type) => { const Icon = contentTypes[type]?.icon || BookOpen; return <span key={type}><Icon size={14} /> {selectedCounts[type] || 0} {contentTypes[type]?.singular || type}</span>; })}<strong>{t("sources.selectedN", { count: selectedItems.length })}</strong></div>
                  <div className="manga-picker__views" role="tablist" aria-label={t("sources.manageTitles")}><button role="tab" aria-selected={pickerView === "selected"} className={pickerView === "selected" ? "active" : ""} onClick={() => setPickerView("selected")}><Bookmark size={15} /><span>{t("sources.myPicks")}</span><small>{selectedItems.length}</small></button><button role="tab" aria-selected={pickerView === "search"} className={pickerView === "search" ? "active" : ""} onClick={() => setPickerView("search")}><Plus size={15} /><span>{t("sources.addTitles")}</span></button></div>
                  {supportedTypes.length > 1 && (
                    <div className="content-type-filter content-type-filter--picker" role="group" aria-label={t("sources.typeFilter")}>
                      <span className="content-type-filter__label">{t("sources.typeFilter")}</span>
                      <div className="content-type-filter__chips">
                        {["all", ...supportedTypes].map((type) => {
                          const meta = contentTypes[type] || contentTypes.all;
                          return (
                            <button
                              key={type}
                              type="button"
                              className={mediaFilter === type ? "active" : ""}
                              aria-pressed={mediaFilter === type}
                              onClick={() => setMediaFilter(type)}
                            >
                              <span>{meta.label}</span>
                              <small>{mediaFilterCounts[type] ?? 0}</small>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {pickerView === "selected" ? <div className="search-box"><Search size={19} /><input value={selectedQuery} onChange={(event) => setSelectedQuery(event.target.value)} placeholder={t("sources.searchPicks")} aria-label={t("sources.searchPicksAria")} />{selectedQuery && <button onClick={() => setSelectedQuery("")} aria-label={t("common.clearSearch")}><X size={16} /></button>}</div> : <div className="search-box"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("sources.searchIn", { name: profile.name })} aria-label={t("sources.searchInAria", { name: profile.name })} />{query && <button onClick={() => setQuery("")} aria-label={t("common.clearSearch")}><X size={16} /></button>}</div>}
                  <p className="manga-picker__hint">{pickerView === "selected" ? t("sources.searchHintSelected") : t("sources.searchHintAdd")}</p>
                  {pickerView === "search" && status === "loading" ? <div className="live-loading live-loading--compact"><RefreshCw size={22} /><strong>{t("sources.searching", { name: profile.name })}</strong></div> : pickerView === "search" && status === "error" ? <div className="live-error live-error--compact"><Wifi size={25} /><h2>{t("sources.searchFailed")}</h2></div> : <>
                    <div className="manga-picker__results">{pagedItems.map((item) => { const selected = selectedUrls.has(item.url); const itemType = getItemType(item); return <button className={selected ? "selected" : ""} key={item.url} onClick={() => onToggleSelection(managedSourceId, item)}><RemoteCover src={item.cover} title={item.title} /><span><strong dir="auto">{item.title}</strong><small>{contentTypes[itemType]?.singular || item.mediaTypeLabel || t("common.content")} · {profile.name}</small></span><i>{selected ? <Check size={16} /> : <Plus size={16} />}</i></button>; })}{pickerView === "selected" && !displayedItems.length && <div className="empty-state empty-state--compact"><Bookmark size={29} /><h2>{selectedItems.length ? t("sources.noResult") : t("sources.noPicks")}</h2><p>{selectedItems.length ? t("sources.changeSearch") : t("sources.goAdd")}</p></div>}{pickerView === "search" && query.trim().length < 2 && <div className="empty-state empty-state--compact"><Search size={29} /><h2>{t("sources.searchIn", { name: profile.name })}</h2><p>{t("sources.typeTwo")}</p></div>}{pickerView === "search" && query.trim().length >= 2 && status === "ready" && !displayedItems.length && <p className="source-no-results">{t("sources.noTypeMatch")}</p>}</div>
                    {displayedItems.length > pickerPageSize && <nav className="manga-picker__pagination" aria-label={t("sources.pagesAria")}><button onClick={() => setPickerPage((page) => Math.max(1, page - 1))} disabled={pickerPage === 1} aria-label={t("common.previous")}><ChevronRight size={16} /></button><span><strong>{pickerPage}</strong><small>{t("common.of", { total: totalPickerPages })}</small></span><button onClick={() => setPickerPage((page) => Math.min(totalPickerPages, page + 1))} disabled={pickerPage === totalPickerPages} aria-label={t("common.next")}><ChevronLeft size={16} /></button></nav>}
                  </>}
                </section>}
              </>}
            </section>
          </div>
          <footer className="source-config-modal__footer"><button onClick={() => setShowConfig(false)}>{t("common.done")}</button><button className="button button--primary" onClick={() => { setShowConfig(false); navigate("sources"); }}><BookOpen size={16} /> {t("sources.showContent")}</button></footer>
        </section>
      </div></SheetPortal>}
    </div>
  );
}
