import React, { useMemo, useState } from "react";
import { BellRing, ChevronLeft, Clock, RefreshCw } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { ChipFilterBar, ChipFilterButton } from "../components/ui/ChipFilterBar";
import { contentTypes } from "../features/sources/contentTypes";
import { useHomeLatestChapters } from "../hooks/useHomeLatestChapters";
import { useI18n } from "../i18n/I18nProvider";
import { HomeLatestChapterRow } from "./HomeLatestChapterRow";

const HOME_PREVIEW_LIMIT = 6;

export const HOME_LATEST_SUPPORTED_FILTERS = new Set(["manga", "novel", "anime", "series"]);

const MEDIA_ACCENTS = {
  all: "brand",
  manga: "manga",
  novel: "novel",
  anime: "anime",
  series: "film",
};

function HomeLatestSkeleton() {
  return (
    <div className="home-latest-panel__feed" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="home-latest-row home-latest-row--skeleton" key={index}>
          <span className="home-latest-row__cover-skeleton" />
          <span className="home-latest-row__body-skeleton">
            <span />
            <span />
            <span />
          </span>
        </div>
      ))}
    </div>
  );
}

function latestCopy(t, mediaFilter) {
  const key = HOME_LATEST_SUPPORTED_FILTERS.has(mediaFilter) ? mediaFilter : "all";
  return {
    title: t(`home.latest.${key}.title`),
    subtitle: t(`home.latest.${key}.subtitle`),
    filterAria: t(`home.latest.${key}.filterAria`),
    refreshAria: t(`home.latest.${key}.refreshAria`),
    emptyUnread: t(`home.latest.${key}.emptyUnread`),
    emptyWindow: t(`home.latest.${key}.emptyWindow`),
    emptyUnreadHint: t(`home.latest.${key}.emptyUnreadHint`),
    emptyWindowHint: t(`home.latest.${key}.emptyWindowHint`),
    followHint: t(`home.latest.${key}.followHint`),
  };
}

function buildMetaLine({ t, trackedCount, entriesCount, newCount, mediaFilter }) {
  const typeLabel = contentTypes[mediaFilter]?.label || contentTypes.all.label;
  const parts = [t("home.latest.tracked", { count: trackedCount })];
  if (entriesCount > 0) parts.push(t("home.latest.window", { count: entriesCount }));
  if (newCount > 0) parts.push(t("home.latest.unread", { count: newCount }));
  if (mediaFilter !== "all") parts.unshift(typeLabel);
  return parts.join(" · ");
}

export function HomeLatestChaptersSection({
  followPreferences,
  readingHistory,
  mediaFilter,
  settings,
  openLiveReader,
  navigate,
}) {
  const { t } = useI18n();
  const [scope, setScope] = useState("all");
  const {
    entries,
    trackedCount,
    loading,
    error,
    pausedForData,
    refresh,
    newCount,
  } = useHomeLatestChapters({
    followPreferences,
    readingHistory,
    mediaFilter,
    settings,
  });
  const copy = latestCopy(t, mediaFilter);
  const accent = MEDIA_ACCENTS[mediaFilter] || MEDIA_ACCENTS.all;
  const TypeIcon = contentTypes[mediaFilter]?.icon || contentTypes.all.icon;

  const visibleEntries = useMemo(() => {
    const filtered = scope === "new" ? entries.filter((entry) => entry.isNew) : entries;
    return filtered.slice(0, HOME_PREVIEW_LIMIT);
  }, [entries, scope]);

  const totalVisible = scope === "new" ? entries.filter((entry) => entry.isNew).length : entries.length;
  const hiddenCount = Math.max(0, totalVisible - visibleEntries.length);
  const metaLine = buildMetaLine({
    t,
    trackedCount,
    entriesCount: entries.length,
    newCount,
    mediaFilter,
  });

  function openEntry(entry) {
    openLiveReader(entry.item, entry.latestChapter);
  }

  return (
    <section
      className={`home-latest-panel home-latest-panel--${accent}`}
      aria-labelledby="home-latest-title"
    >
      <header className="home-latest-panel__head">
        <span className="home-latest-panel__icon" aria-hidden="true">
          <TypeIcon size={15} />
        </span>
        <div className="home-latest-panel__intro">
          <h2 id="home-latest-title">{copy.title}</h2>
          <p>{trackedCount > 0 ? metaLine : copy.subtitle}</p>
        </div>
        <button
          type="button"
          className={`home-latest-panel__refresh${loading ? " is-syncing" : ""}`}
          onClick={() => refresh()}
          disabled={loading || !trackedCount}
          aria-label={copy.refreshAria}
        >
          <RefreshCw size={14} />
        </button>
      </header>

      {trackedCount > 0 && (
        <div className="home-latest-panel__toolbar">
          <ChipFilterBar
            variant="segmented"
            className="home-latest-panel__filter"
            role="tablist"
            ariaLabel={copy.filterAria}
          >
            <ChipFilterButton
              role="tab"
              active={scope === "all"}
              ariaSelected={scope === "all"}
              count={entries.length}
              onClick={() => setScope("all")}
            >
              {t("home.latest.last24")}
            </ChipFilterButton>
            <ChipFilterButton
              role="tab"
              active={scope === "new"}
              ariaSelected={scope === "new"}
              count={newCount}
              onClick={() => setScope("new")}
            >
              {t("home.latest.unreadChip")}
            </ChipFilterButton>
          </ChipFilterBar>
          <button type="button" className="home-latest-panel__link" onClick={() => navigate("updates")}>
            {t("home.latest.allUpdates")}
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {loading && !entries.length ? (
        <HomeLatestSkeleton />
      ) : visibleEntries.length ? (
        <>
          <div className={`home-latest-panel__feed${loading ? " is-refreshing" : ""}`}>
            {visibleEntries.map((entry) => (
              <HomeLatestChapterRow
                key={`${entry.item.sourceId}:${entry.item.url}:${entry.latestChapter.url}`}
                entry={entry}
                onClick={() => openEntry(entry)}
              />
            ))}
          </div>
          {hiddenCount > 0 && (
            <button type="button" className="home-latest-panel__more" onClick={() => navigate("updates")}>
              {t("home.latest.showMore", { count: hiddenCount })}
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
          )}
        </>
      ) : trackedCount > 0 ? (
        <EmptyState
          className="home-latest-panel__empty"
          icon={scope === "new" ? BellRing : Clock}
          title={pausedForData
            ? (settings?.homeAutoUpdates === false
              ? t("home.latest.autoOff")
              : t("home.latest.saverOn"))
            : scope === "new" ? copy.emptyUnread : copy.emptyWindow}
          description={pausedForData
            ? (settings?.homeAutoUpdates === false
              ? t("home.latest.autoOffHint")
              : t("home.latest.saverHint"))
            : error || (scope === "new" ? copy.emptyUnreadHint : copy.emptyWindowHint)}
          actionLabel={t("home.latest.refreshNow")}
          onAction={() => refresh({ force: true })}
        />
      ) : (
        <EmptyState
          className="home-latest-panel__empty"
          icon={BellRing}
          title={t("home.latest.noFollow")}
          description={copy.followHint}
          actionLabel={t("home.latest.discover")}
          onAction={() => navigate("sources")}
        />
      )}
    </section>
  );
}
