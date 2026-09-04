import React, { useMemo, useState } from "react";
import { Header } from "../components/layout/Header";
import { ChipFilterBar, ChipFilterButton } from "../components/ui/ChipFilterBar";
import { contentTypes } from "../features/sources";
import { manga as demoCatalog } from "../data/demoManga";
import { HomeDiscoverySection } from "./HomeDiscoverySection";
import { HomeContinueHero } from "./HomeContinueHero";
import { HomeLatestChaptersSection, HOME_LATEST_SUPPORTED_FILTERS } from "./HomeLatestChaptersSection";
import {
  countHistoryByType,
  getLatestReadingEntry,
} from "../lib/readingProgress";
import { isVideoMediaType } from "../features/sources/mediaPresentation";
import { isChromebookApp, VISIBLE_MEDIA_TYPES } from "../config/appFlavor";
import { useI18n } from "../i18n/I18nProvider";
import { getAppBrandText } from "../lib/brand/appBrand";
import { continueHomeReading, prefetchLiveTitle } from "./homeActions";

const MEDIA_FILTERS = VISIBLE_MEDIA_TYPES;

function resolveInitialMediaFilter(readingHistory, liveFavorites) {
  const latest = getLatestReadingEntry(readingHistory, {
    mediaType: "all",
    demoCatalog,
    liveFavorites,
  });
  if (latest?.type && MEDIA_FILTERS.includes(latest.type)) {
    return latest.type;
  }
  return MEDIA_FILTERS.includes("series") ? "series" : MEDIA_FILTERS[0];
}

export function HomeScreen({
  sources,
  activeSourceId,
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
  const brand = getAppBrandText(t);

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

  const continueActions = useMemo(() => ({
    openManga,
    openReader,
    openLiveManga,
    openLiveReader,
    navigate,
  }), [navigate, openLiveManga, openLiveReader, openManga, openReader]);

  const handleContinue = () => {
    void continueHomeReading(latestEntry, continueActions);
  };

  const handlePrefetchContinue = () => {
    const target = latestEntry?.target;
    if (!target || target.kind === "demo") return;
    prefetchLiveTitle(target.item, target.chapter);
  };

  const typeLabel = latestEntry
    ? contentTypes[latestEntry.type]?.singular || t("common.content")
    : contentTypes[mediaFilter]?.singular || t("common.content");
  const isVideoContinue = isVideoMediaType(latestEntry?.type || mediaFilter);

  return (
    <div className="screen screen--home">
      {!isChromebookApp && (
        <Header
          title={brand.name}
          titleLead={brand.nameLead}
          titleTail={brand.nameTail}
          eyebrow={t("home.eyebrow")}
          brandTitle
          showBrand
          appearance={appearance}
          onSearch={() => navigate("search")}
          onReadingHistory={() => navigate("reading-history")}
          onNotifications={() => navigate("updates")}
        />
      )}

      <main className="content">
        <div className="home-hero-panel">
          <HomeContinueHero
            entry={latestEntry}
            typeLabel={typeLabel}
            isVideoContinue={isVideoContinue}
            onContinue={handleContinue}
            onPrefetch={handlePrefetchContinue}
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

        {!isChromebookApp && (
          <HomeDiscoverySection
            sources={sources}
            sourcePreferences={sourcePreferences}
            activeSourceId={activeSourceId}
            onOpenCatalog={() => navigate("sources")}
            onManage={() => navigate("source-management")}
          />
        )}

        {HOME_LATEST_SUPPORTED_FILTERS.has(mediaFilter) ? (
          <HomeLatestChaptersSection
            followPreferences={followPreferences}
            readingHistory={readingHistory}
            mediaFilter={mediaFilter}
            settings={settings}
            openLiveReader={openLiveReader}
            openLiveManga={openLiveManga}
            navigate={navigate}
          />
        ) : null}
      </main>
    </div>
  );
}
