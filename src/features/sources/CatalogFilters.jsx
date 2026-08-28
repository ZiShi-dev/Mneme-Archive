import React, { useEffect, useMemo, useState } from "react";
import { Check, LayoutGrid, Search, Tag, UserRound, X } from "lucide-react";
import { useI18n } from "../../i18n/I18nProvider";
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
    author: {
      title: t("sources.pickAuthor"),
      label: t("sources.authors"),
      icon: UserRound,
      countLabel: (count) => t("sources.authorCount", { count }),
      searchPlaceholder: t("sources.searchAuthor"),
      empty: t("sources.noAuthor"),
      prefix: "",
    },
  };
}

export function CatalogFilters({ categories = [], tags = [], authors = [], kinds = [], selected, selectedKind, loading, onSelect, onSelectKind }) {
  const { t } = useI18n();
  const pickerMeta = useMemo(() => getPickerMeta(t), [t]);
  const [activeKind, setActiveKind] = useState("category");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const entries = activeKind === "category" ? categories : activeKind === "tag" ? tags : authors;
  const meta = pickerMeta[activeKind];
  const PickerIcon = meta.icon;

  const searchedEntries = useMemo(() => {
    const normalized = filterQuery.trim().toLocaleLowerCase("ar");
    return normalized ? entries.filter((entry) => entry.name.toLocaleLowerCase("ar").includes(normalized)) : entries;
  }, [entries, filterQuery]);

  const selectedKindSlug = useMemo(() => {
    if (!kinds.length) return "";
    if (!selectedKind || selectedKind.slug === "all") return "all";
    return selectedKind.slug;
  }, [kinds, selectedKind]);

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

  const hasKinds = kinds.length > 0;
  const showClear = Boolean(selected) && selected.slug !== "all";

  if (loading && !hasKinds) {
    return <ChipFilterBar label={t("sources.filter")} loading ariaLabel={t("sources.loadingFilters")} />;
  }

  if (!categories.length && !tags.length && !authors.length && !hasKinds) return null;

  const chooseKind = (kind) => {
    onSelectKind?.(kind);
  };

  const openPicker = (kind) => {
    setActiveKind(kind);
    setFilterQuery("");
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    setFilterQuery("");
  };

  const choose = (entry) => {
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

  const clearSelection = () => {
    onSelect(null);
    closePicker();
  };

  const isSelected = (entry) => selected?.type === activeKind && selected.slug === entry.slug;

  return (
    <>
      {hasKinds && (
        <ChipFilterBar variant="segmented" role="group" ariaLabel={t("sources.kind")} label={t("sources.kind")}>
          {kinds.map((kind) => (
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
      {!loading && (categories.length > 0 || tags.length > 0 || authors.length > 0) && (
      <ChipFilterBar
        label={t("sources.filter")}
        role="group"
        ariaLabel={t("sources.catalogFilters")}
        showClear={showClear}
        onClear={clearSelection}
      >
        <ChipFilterButton
          active={selected?.type === "category"}
          disabled={!categories.length}
          icon={LayoutGrid}
          count={selected?.type !== "category" && categories.length > 0 ? categories.length : undefined}
          onClick={() => openPicker("category")}
        >
          {selected?.type === "category" ? selected.name : t("sources.genres")}
        </ChipFilterButton>
        <ChipFilterButton
          active={selected?.type === "tag"}
          disabled={!tags.length}
          icon={Tag}
          count={selected?.type !== "tag" && tags.length > 0 ? tags.length : undefined}
          onClick={() => openPicker("tag")}
        >
          {selected?.type === "tag" ? `#${selected.name}` : t("sources.tags")}
        </ChipFilterButton>
        {authors.length > 0 && (
          <ChipFilterButton
            active={selected?.type === "author"}
            disabled={!authors.length}
            icon={UserRound}
            count={selected?.type !== "author" && authors.length > 0 ? authors.length : undefined}
            onClick={() => openPicker("author")}
          >
            {selected?.type === "author" ? selected.name : t("sources.authors")}
          </ChipFilterButton>
        )}
      </ChipFilterBar>
      )}

      {pickerOpen && (
        <SheetPortal>
        <div
          className="catalog-filter-picker-backdrop"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closePicker(); }}
        >
          <section
            className="catalog-filter-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-filter-picker-title"
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
                { id: "author", label: t("sources.authors"), count: authors.length, disabled: !authors.length },
              ].filter((tab) => tab.id !== "author" || authors.length > 0).map((tab) => {
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
