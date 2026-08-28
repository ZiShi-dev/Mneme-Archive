import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSourceProfile } from "../../config/sources";
import { useI18n } from "../../i18n/I18nProvider";
import { getItemType, contentTypes } from "./contentTypes";
import { isVideoMediaType } from "./mediaPresentation";
import { CoverAudioBadge } from "./CatalogCard";
import { RemoteCover } from "./RemoteCover";
import { SourceLogo } from "./SourceLogo";

export const SEARCH_RESULTS_PAGE_SIZE = 8;
const SEARCH_GROUP_PREVIEW_SIZE = 3;

export function SearchResultRow({ item, onOpen, showSource = true }) {
  const type = getItemType(item);
  const typeLabel = contentTypes[type]?.singular || contentTypes.manga.singular;
  const subtitle = item.altTitle || item.subtitle;
  const sourceName = item.sourceName || getSourceProfile(item.sourceId).name;

  return (
    <article className="search-result-row">
      <button type="button" className="search-result-row__open" onClick={() => onOpen(item)}>
        <span className="search-result-row__media">
          <RemoteCover src={item.cover} title={item.title} sourceId={item.sourceId} video={isVideoMediaType(type)} />
          <span className={`search-result-row__type search-result-row__type--${type}`}>{typeLabel}</span>
          {item.audioLabel ? <CoverAudioBadge label={item.audioLabel} /> : null}
        </span>
        <span className="search-result-row__body">
          <strong dir="auto">{item.title}</strong>
          {subtitle && <span className="search-result-row__subtitle" dir="auto">{subtitle}</span>}
          {showSource && (
            <span className="search-result-row__meta">
              <SourceLogo sourceId={item.sourceId} />
              <span>{sourceName}</span>
            </span>
          )}
        </span>
        <ChevronLeft size={16} className="search-result-row__chevron" aria-hidden="true" />
      </button>
    </article>
  );
}

function groupSearchResults(results) {
  const groups = new Map();
  results.forEach((item) => {
    const sourceId = item.sourceId;
    if (!groups.has(sourceId)) {
      groups.set(sourceId, {
        sourceId,
        sourceName: item.sourceName || getSourceProfile(sourceId).name,
        items: [],
      });
    }
    groups.get(sourceId).items.push(item);
  });
  return [...groups.values()];
}

export function SearchResultsSkeleton({ count = 4 }) {
  return (
    <div className="search-results search-results--loading" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="search-result-skeleton">
          <span className="search-result-skeleton__cover" />
          <span className="search-result-skeleton__copy">
            <i />
            <i />
            <i />
          </span>
        </div>
      ))}
    </div>
  );
}

export function SearchResultsPagination({ page, totalPages, totalItems, pageSize, onPageChange }) {
  const { t } = useI18n();
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <nav className="search-results-pagination" aria-label={t("search.pagesAria")}>
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1} aria-label={t("common.previous")}>
        <ChevronRight size={16} />
      </button>
      <span>
        <strong>{start}-{end}</strong>
        <small>{t("common.of", { total: totalItems })}</small>
      </span>
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page === totalPages} aria-label={t("common.next")}>
        <ChevronLeft size={16} />
      </button>
    </nav>
  );
}

export function SearchResultsList({ results, onOpen, groupBySource = false }) {
  const { t } = useI18n();
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const groups = useMemo(() => {
    if (!groupBySource) return [{ sourceId: null, sourceName: null, items: results }];
    return groupSearchResults(results);
  }, [groupBySource, results]);

  const toggleGroup = (sourceId) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  };

  return (
    <div className="search-results">
      {groups.map((group) => {
        const isExpanded = !group.sourceId || expandedGroups.has(group.sourceId);
        const hasHiddenItems = groupBySource && group.items.length > SEARCH_GROUP_PREVIEW_SIZE;
        const visibleItems = groupBySource && !isExpanded
          ? group.items.slice(0, SEARCH_GROUP_PREVIEW_SIZE)
          : group.items;
        const hiddenCount = group.items.length - SEARCH_GROUP_PREVIEW_SIZE;

        return (
          <section key={group.sourceId || "all"} className="search-results__group">
            {groupBySource && (
              <header className="search-results__group-head">
                <SourceLogo sourceId={group.sourceId} />
                <span>{group.sourceName}</span>
                <em>{group.items.length}</em>
              </header>
            )}
            <div className="search-results__list">
              {visibleItems.map((item) => (
                <SearchResultRow
                  key={item.key}
                  item={item}
                  onOpen={onOpen}
                  showSource={!groupBySource}
                />
              ))}
            </div>
            {hasHiddenItems && !isExpanded && (
              <button
                type="button"
                className="search-results__more"
                onClick={() => toggleGroup(group.sourceId)}
              >
                {t("search.showMore", { count: hiddenCount, source: group.sourceName })}
              </button>
            )}
            {hasHiddenItems && isExpanded && (
              <button
                type="button"
                className="search-results__more search-results__more--collapse"
                onClick={() => toggleGroup(group.sourceId)}
              >
                {t("search.showLess")}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
