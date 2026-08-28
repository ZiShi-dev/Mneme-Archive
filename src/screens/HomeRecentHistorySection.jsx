import React, { useMemo } from "react";
import { ChevronLeft, Film, History } from "lucide-react";
import { contentTypes } from "../features/sources/contentTypes";
import {
  chapterFromRecord,
  enrichHistoryEntries,
  isRecordCompleted,
} from "../lib/readingProgress";
import { useI18n } from "../i18n/I18nProvider";
import { HomeLatestChapterRow } from "./HomeLatestChapterRow";

const PREVIEW_LIMIT = 5;

function toPreviewEntry(historyEntry) {
  const { record, target, type } = historyEntry;
  const chapter = chapterFromRecord(record);
  return {
    item: target.item,
    latestChapter: chapter,
    publishedAt: record.lastReadAt,
    mediaType: type,
    isNew: !isRecordCompleted(record),
  };
}

export function HomeRecentHistorySection({
  readingHistory,
  liveFavorites,
  mediaFilter,
  heroEntry,
  openLiveReader,
  openLiveManga,
  navigate,
}) {
  const { t } = useI18n();

  const { entries, totalCount } = useMemo(() => {
    const heroUrl = heroEntry?.record?.titleUrl;
    const history = enrichHistoryEntries(readingHistory, { liveFavorites })
      .filter((entry) => entry.target && entry.type === mediaFilter);

    const recent = history
      .filter((entry, index) => !(index === 0 && entry.record.titleUrl === heroUrl))
      .slice(0, PREVIEW_LIMIT)
      .map(toPreviewEntry);

    return { entries: recent, totalCount: history.length };
  }, [heroEntry, liveFavorites, mediaFilter, readingHistory]);

  if (mediaFilter !== "movie" || !totalCount) return null;

  const copy = {
    title: t("home.watchHistory"),
    subtitle: t("home.recentMovies"),
    historyLink: t("home.fullWatchHistory"),
  };

  const TypeIcon = contentTypes[mediaFilter]?.icon || Film;

  function openEntry(entry) {
    if (entry.latestChapter?.url) openLiveReader(entry.item, entry.latestChapter);
    else openLiveManga(entry.item);
  }

  return (
    <section className="home-recent-panel home-recent-panel--film" aria-labelledby="home-recent-title">
      <header className="home-recent-panel__head">
        <span className="home-recent-panel__icon" aria-hidden="true">
          <TypeIcon size={15} />
        </span>
        <div className="home-recent-panel__intro">
          <h2 id="home-recent-title">{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>
        <button
          type="button"
          className="home-recent-panel__link"
          onClick={() => navigate("reading-history")}
          aria-label={copy.historyLink}
        >
          <History size={14} aria-hidden="true" />
        </button>
      </header>

      {entries.length > 0 && (
        <div className="home-recent-panel__feed">
          {entries.map((entry) => (
            <HomeLatestChapterRow
              key={`${entry.item.sourceId}:${entry.item.url}:${entry.latestChapter?.url || entry.item.url}`}
              entry={entry}
              onClick={() => openEntry(entry)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="home-recent-panel__more"
        onClick={() => navigate("reading-history")}
      >
        {copy.historyLink}
        <ChevronLeft size={15} aria-hidden="true" />
      </button>
    </section>
  );
}
