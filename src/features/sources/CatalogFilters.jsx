import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, LayoutGrid, Search, Tag, X } from "lucide-react";
import { useI18n } from "../../i18n/I18nProvider";
import { AUDIO_LANGUAGE_LABELS } from "./audioLanguage";
import { localizeCatalogKinds } from "./contentTypes";
import { toggleTaxonomySelection, normalizeTaxonomySelection, isTaxonomySelectionEmpty } from "./catalogView";
import { ChipFilterBar, ChipFilterButton } from "../../components/ui/ChipFilterBar";
import { AccessibleSearchField } from "../../components/ui/AccessibleSearchField";
import { SheetCloseButton } from "../../components/ui/SheetCloseButton";
import { SheetPortal } from "../../components/ui/SheetPortal";

function getPickerMeta(t) {
  return {
    category: {
      title: t("sources.pickGenre"),
      label: t("sources.genres"),
      icon: LayoutGrid,
      countLabel: (count) => t("sources.genreCount", { count }),
      searchPlaceholder: t("sources.searchGenre"),
      empty: t("sources.noGenre"),
      prefix: "",
    },
    tag: {
      title: t("sources.pickTag"),
      label: t("sources.tags"),
      icon: Tag,
      countLabel: (count) => t("sources.tagCount", { count }),
      searchPlaceholder: t("sources.searchTag"),
      empty: t("sources.noTag"),
      prefix: "#",
    },
  };
}

function CatalogFiltersSkeleton() {
  const { t } = useI18n();
  return (
    <div className="catalog-filters-skeleton" aria-busy="true" aria-live="polite" aria-label={t("sources.loadingFilters")}>
      <div className="catalog-filters-skeleton__head">
        <span className="catalog-filters-skeleton__icon" aria-hidden="true">
          <LayoutGrid size={14} />
        </span>
        <span className="catalog-filters-skeleton__title">{t("sources.filter")}</span>
      </div>
      <div className="catalog-filters-skeleton__chips" aria-hidden="true">
        <span className="catalog-filters-skeleton__chip catalog-filters-skeleton__chip--genre" />
        <span className="catalog-filters-skeleton__chip catalog-filters-skeleton__chip--tag" />
      </div>
      <p className="catalog-filters-skeleton__hint">{t("sources.loadingFilters")}</p>
    </div>
  );
}

export function CatalogFilters({
  categories = [],
  tags = [],
  kinds = [],
  selected,
  selectedKind,
  selectedAudioFilter = "all",
  showAudioFilter = false,
  onSelectAudioFilter,
  loading,
  multiSelect = false,
  onSelect,
  onSelectKind,
}) {
  const { t } = useI18n();
  const pickerMeta = useMemo(() => getPickerMeta(t), [t]);
  const [activeKind, setActiveKind] = useState("category");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const backdropPointerDownRef = useRef(false);
  const entries = activeKind === "category" ? categories : tags;
  const meta = pickerMeta[activeKind];
  const PickerIcon = meta.icon;
  const selectedTaxonomies = useMemo(() => normalizeTaxonomySelection(selected), [selected]);

  const searchedEntries = useMemo(() => {
    const normalized = filterQuery.trim().toLocaleLowerCase("ar");
    return normalized ? entries.filter((entry) => entry.name.toLocaleLowerCase("ar").includes(normalized)) : entries;
  }, [entries, filterQuery]);

  const localizedKinds = useMemo(() => localizeCatalogKinds(kinds), [kinds, t]);
  const hasKinds = localizedKinds.length > 0;
  const showTaxonomyBar = categories.length > 0 || tags.length > 0;

  const selectedKindSlug = useMemo(() => {
    if (!localizedKinds.length) return "";
    if (!selectedKind || selectedKind.slug === "all") {
      return localizedKinds.some((kind) => kind.slug === "all") ? "all" : (localizedKinds[0]?.slug || "");
    }
    return selectedKind.slug;
  }, [localizedKinds, selectedKind]);

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

  const showClear = multiSelect
    ? !isTaxonomySelectionEmpty(selected)
    : Boolean(selected) && selected.slug !== "all";

  if (loading && !hasKinds && !showAudioFilter && !showTaxonomyBar) {
    return <CatalogFiltersSkeleton />;
  }

  if (!showTaxonomyBar && !hasKinds && !showAudioFilter) return null;

  const chooseKind = (kind) => {
    onSelectKind?.(kind);
  };

  const openPicker = (kind) => {
    setActiveKind(kind || "category");
    setFilterQuery("");
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    setFilterQuery("");
  };

  const choose = (entry) => {
    if (multiSelect) {
      onSelect(toggleTaxonomySelection(selected, activeKind, entry));
      return;
    }
    onSelect({
      type: activeKind,
      slug: entry.slug,
      name: entry.name,
      archivePath: entry.archivePath,
      filterPath: entry.filterPath,
      queryParam: entry.queryParam,
      queryValue: entry.queryValue,
    });
    closePicker();
  };

  const handleBackdropPointerDown = (event) => {
    backdropPointerDownRef.current = event.target === event.currentTarget;
  };

  const handleBackdropPointerUp = (event) => {
    if (!backdropPointerDownRef.current) return;
    backdropPointerDownRef.current = false;
    if (event.target !== event.currentTarget) return;
    closePicker();
  };

  const stopPickerPointer = (event) => {
    event.stopPropagation();
  };

  const clearSelection = () => {
    onSelect(null);
    closePicker();
  };

  const isSelected = (entry) => {
    if (multiSelect) {
      return selectedTaxonomies[activeKind]?.slug === entry.slug;
    }
    return selected?.type === activeKind && selected.slug === entry.slug;
  };

  return (
    <>
      {hasKinds && (
        <ChipFilterBar variant="segmented" role="group" ariaLabel={t("sources.kind")} label={t("sources.kind")}>
          {localizedKinds.map((kind) => (
            <ChipFilterButton
              key={kind.slug}
              active={selectedKindSlug === kind.slug}
              onClick={() => chooseKind(kind)}
            >
              {kind.name}
            </ChipFilterButton>
          ))}
        </ChipFilterBar>
      )}
      {showAudioFilter && (
        <ChipFilterBar variant="segmented" role="group" ariaLabel={t("sources.audioFilter")} label={t("sources.audioFilter")}>
          <ChipFilterButton
            active={!selectedAudioFilter || selectedAudioFilter === "all"}
            onClick={() => onSelectAudioFilter?.("all")}
          >
            {t("common.all")}
          </ChipFilterButton>
          {["VF", "VOSTFR"].map((value) => (
            <ChipFilterButton
              key={value}
              active={selectedAudioFilter === value}
              onClick={() => onSelectAudioFilter?.(value)}
            >
              {AUDIO_LANGUAGE_LABELS[value]}
            </ChipFilterButton>
          ))}
        </ChipFilterBar>
      )}
      {showTaxonomyBar && (
      <ChipFilterBar
        className="catalog-taxonomy-filters catalog-taxonomy-filters--ready"
        label={t("sources.filter")}
        role="group"
        ariaLabel={t("sources.catalogFilters")}
        showClear={showClear}
        onClear={clearSelection}
      >
        {categories.length > 0 && (
        <ChipFilterButton
          active={multiSelect ? Boolean(selectedTaxonomies.category) : selected?.type === "category"}
          disabled={!categories.length}
          icon={LayoutGrid}
          bordered
          picker
          count={!selectedTaxonomies.category && categories.length > 0 ? categories.length : undefined}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen && activeKind === "category"}
          onClick={() => openPicker("category")}
        >
          {selectedTaxonomies.category ? selectedTaxonomies.category.name : t("sources.genres")}
        </ChipFilterButton>
        )}
        {tags.length > 0 && (
        <ChipFilterButton
          active={multiSelect ? Boolean(selectedTaxonomies.tag) : selected?.type === "tag"}
          disabled={!tags.length}
          icon={Tag}
          bordered
          picker
          count={!selectedTaxonomies.tag && tags.length > 0 ? tags.length : undefined}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen && activeKind === "tag"}
          onClick={() => openPicker("tag")}
        >
          {selectedTaxonomies.tag ? `#${selectedTaxonomies.tag.name}` : t("sources.tags")}
        </ChipFilterButton>
        )}
      </ChipFilterBar>
      )}

      {pickerOpen && (
        <SheetPortal>
        <div
          className="catalog-filter-picker-backdrop"
          onPointerDown={handleBackdropPointerDown}
          onPointerUp={handleBackdropPointerUp}
          onPointerCancel={() => { backdropPointerDownRef.current = false; }}
        >
          <section
            className="catalog-filter-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-filter-picker-title"
            onPointerDown={stopPickerPointer}
          >
            <header className="catalog-filter-picker__header">
              <div className="catalog-filter-picker__title">
                <span className="catalog-filter-picker__badge" aria-hidden="true"><PickerIcon size={15} /></span>
                <div>
                  <small>{meta.countLabel(entries.length)}</small>
                  <h2 id="catalog-filter-picker-title">{meta.title}</h2>
                </div>
              </div>
              <SheetCloseButton onClick={closePicker} />
            </header>

            <div className="catalog-filter-picker__tabs" role="tablist" aria-label={t("sources.filterType")}>
              {[
                { id: "category", label: t("sources.genres"), count: categories.length, disabled: !categories.length },
                { id: "tag", label: t("sources.tags"), count: tags.length, disabled: !tags.length },
              ].filter((tab) => {
                if (tab.id === "category") return categories.length > 0;
                if (tab.id === "tag") return tags.length > 0;
                return false;
              }).map((tab) => {
                const TabIcon = pickerMeta[tab.id].icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeKind === tab.id}
                    className={activeKind === tab.id ? "active" : ""}
                    disabled={tab.disabled}
                    onClick={() => { setActiveKind(tab.id); setFilterQuery(""); }}
                  >
                    <TabIcon size={12} aria-hidden="true" />
                    <span>{tab.label}</span>
                    <small>{tab.count}</small>
                  </button>
                );
              })}
            </div>

            <AccessibleSearchField
              className="global-search catalog-filter-picker__search"
              value={filterQuery}
              onChange={setFilterQuery}
              placeholder={meta.searchPlaceholder}
              ariaLabel={t("sources.searchFilters")}
            />

            <div className="catalog-filter-picker__list" role="listbox" aria-label={meta.title}>
              <button
                type="button"
                className={`catalog-filter-picker__option catalog-filter-picker__option--all${!showClear ? " active" : ""}`}
                onClick={clearSelection}
                onPointerDown={stopPickerPointer}
              >
                <span>{t("sources.showAll")}</span>
                {!selected && <Check size={14} aria-hidden="true" />}
              </button>

              {searchedEntries.map((entry) => (
                <button
                  key={`${activeKind}-${entry.slug}`}
                  type="button"
                  className={`catalog-filter-picker__option${isSelected(entry) ? " active" : ""}`}
                  onClick={() => choose(entry)}
                  onPointerDown={stopPickerPointer}
                >
                  <span>{meta.prefix}{entry.name}</span>
                  {entry.count > 0 && <small>{entry.count}</small>}
                  {isSelected(entry) && <Check size={14} aria-hidden="true" />}
                </button>
              ))}

              {!searchedEntries.length && (
                <div className="catalog-filter-picker__empty">
                  <Search size={22} aria-hidden="true" />
                  <p>{meta.empty}</p>
                </div>
              )}
            </div>

            <footer className="catalog-filter-picker__footer">
              <span>{t("sources.results", { count: searchedEntries.length })}</span>
              {showClear && (
                <button type="button" onClick={clearSelection}>
                  {t("common.clearFilter")}
                </button>
              )}
            </footer>
          </section>
        </div>
        </SheetPortal>
      )}
    </>
  );
}
