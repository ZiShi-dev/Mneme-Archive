import React, { useMemo, useState } from "react";
import { Header } from "../components/layout/Header";
import { ChipFilterBar, ChipFilterButton } from "../components/ui/ChipFilterBar";
import { contentTypes } from "../features/sources";
import { manga as demoCatalog } from "../data/demoManga";
import { HomeDiscoverySection } from "./HomeDiscoverySection";
import { HomeContinueHero } from "./HomeContinueHero";
import { HomeLatestChaptersSection, HOME_LATEST_SUPPORTED_FILTERS } from "./HomeLatestChaptersSection";
import { HomeRecentHistorySection } from "./HomeRecentHistorySection";
import {
  countHistoryByType,
  getLatestReadingEntry,
} from "../lib/readingProgress";
import { useI18n } from "../i18n/I18nProvider";

const MEDIA_FILTERS = ["manga", "novel", "anime", "movie", "series"];

function resolveInitialMediaFilter(readingHistory, liveFavorites) {
  const latest = getLatestReadingEntry(readingHistory, {
    mediaType: "all",
    demoCatalog,
    liveFavorites,
  });
  if (latest?.type && MEDIA_FILTERS.includes(latest.type)) {
    return latest.type;
  }
  return "manga";
}

function continueReading(entry, { openManga, openReader, openLiveManga, openLiveReader }) {
  const { target } = entry;
  if (!target) return;
  if (target.kind === "demo") {
    if (target.chapter) openReader(target.item, target.chapter.number);
    else openManga(target.item);
    return;
  }
  if (target.chapter?.url) openLiveReader(target.item, target.chapter);
  else openLiveManga(target.item);
}

export function HomeScreen({
  sources,
  sourcePreferences,
  readingHistory,
  liveFavorites,
  followPreferences,
  openManga,
  openReader,
  openLiveManga,
  openLiveReader,
  navigate,
  settings,
  appearance,
}) {
  const [mediaFilter, setMediaFilter] = useState(() => resolveInitialMediaFilter(readingHistory, liveFavorites));
  const { t } = useI18n();

  const historyCounts = useMemo(
    () => countHistoryByType(readingHistory, { demoCatalog, liveFavorites }),
    [liveFavorites, readingHistory],
  );

  const latestEntry = useMemo(
    () => getLatestReadingEntry(readingHistory, {
      mediaType: mediaFilter,
      demoCatalog,
      liveFavorites,
    }),
    [liveFavorites, mediaFilter, readingHistory],
  );

  const handleContinue = () => {
    if (!latestEntry) {
      navigate("sources");
      return;
    }
    continueReading(latestEntry, { openManga, openReader, openLiveManga, openLiveReader });
  };

  const typeLabel = latestEntry
    ? contentTypes[latestEntry.type]?.singular || t("common.content")
    : contentTypes[mediaFilter]?.singular || t("common.content");
  const isVideoContinue = latestEntry?.type === "anime" || latestEntry?.type === "movie" || latestEntry?.type === "series";

  return (
    <div className="screen screen--home">
      <Header
        title={t("home.title")}
        eyebrow={t("home.eyebrow")}
        showBrand
        appearance={appearance}
        onSearch={() => navigate("search")}
        onReadingHistory={() => navigate("reading-history")}
        onNotifications={() => navigate("updates")}
      />

      <main className="content">
        <div className="home-hero-panel">
          <HomeContinueHero
            entry={latestEntry}
            typeLabel={typeLabel}
            isVideoContinue={isVideoContinue}
            onContinue={handleContinue}
            onDiscover={() => navigate(historyCounts.all ? "reading-history" : "sources")}
            emptyTypeLabel={typeLabel}
            emptyDescription={t("home.noHistoryForType", { type: typeLabel })}
            emptyActionLabel={historyCounts.all ? t("common.readingHistory") : t("home.discover")}
          />

          <div className="home-hero-panel__track">
            <ChipFilterBar
              variant="segmented"
              className="home-hero-panel__filters"
              role="group"
              ariaLabel={t("home.mediaTypes")}
            >
              {MEDIA_FILTERS.map((filterId) => (
                <ChipFilterButton
                  key={filterId}
                  active={mediaFilter === filterId}
                  onClick={() => setMediaFilter(filterId)}
                >
                  {contentTypes[filterId].label}
                </ChipFilterButton>
              ))}
            </ChipFilterBar>
          </div>
        </div>

        <HomeDiscoverySection
          sources={sources}
          sourcePreferences={sourcePreferences}
          onOpenCatalog={() => navigate("sources")}
          onManage={() => navigate("source-management")}
        />

        {HOME_LATEST_SUPPORTED_FILTERS.has(mediaFilter) ? (
          <HomeLatestChaptersSection
            followPreferences={followPreferences}
            readingHistory={readingHistory}
            mediaFilter={mediaFilter}
            settings={settings}
            openLiveReader={openLiveReader}
            navigate={navigate}
          />
        ) : mediaFilter === "movie" ? (
          <HomeRecentHistorySection
            readingHistory={readingHistory}
            liveFavorites={liveFavorites}
            mediaFilter={mediaFilter}
            heroEntry={latestEntry}
            openLiveReader={openLiveReader}
            openLiveManga={openLiveManga}
            navigate={navigate}
          />
        ) : null}
      </main>
    </div>
  );
}
