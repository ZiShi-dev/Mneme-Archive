import React, { Suspense, lazy, useCallback, useEffect, useRef } from "react";
import { BottomNav, DesktopMenu } from "./components/layout/BottomNav";
import { AppRoutes } from "./components/layout/AppRoutes";
import { ThemedScrollbar } from "./components/layout/ThemedScrollbar";
import { useToast } from "./components/ui/ToastProvider";
import { useAppNavigation } from "./hooks/useAppNavigation";
import { useAppActionHandlers } from "./hooks/useAppActionHandlers";
import { useAppPreferences } from "./hooks/useAppPreferences";
import { useChapterFollow } from "./hooks/useChapterFollow";
import { useRealtimeFollowSync } from "./hooks/useRealtimeFollowSync";
import { useBackgroundFollowTask } from "./hooks/useBackgroundFollowTask";
import { DEFAULT_APP_SETTINGS } from "./lib/settings/defaults";
import { normalizeSettings } from "./lib/settings/normalizeSettings";
import { setRuntimeSettings } from "./lib/settings/runtimeSettings";
import { usePersistedState } from "./hooks/usePersistedState";
import { Reader } from "./screens/DemoMangaScreens";
import { getItemType } from "./features/sources/contentTypes";
import { isVideoMediaType } from "./features/sources/mediaPresentation";
import { MoonSeaWater } from "./components/atmosphere/MoonSeaWater";
import { MoonSnowfall } from "./components/atmosphere/MoonSnowfall";
import { YozakuraNight } from "./components/atmosphere/YozakuraNight";
import { SakuraDay } from "./components/atmosphere/SakuraDay";
import { InkAtmosphere } from "./components/atmosphere/InkAtmosphere";
import { PaperAtmosphere } from "./components/atmosphere/PaperAtmosphere";
import { GalaxyAtmosphere } from "./components/atmosphere/GalaxyAtmosphere";
import { SakuraIcon } from "./components/atmosphere/SakuraIcon";
import { MnemeMark } from "./components/brand/MnemeMark";
import { AppBrandName } from "./components/brand/AppBrandName";
import {
  isSakuraTheme,
  isSnowTheme,
  isGalaxyTheme,
  hasAtmosphereEffect,
  THEME_YOZAKURA,
  THEME_SAKURA,
  THEME_INK,
  THEME_PAPER,
} from "./lib/theme/appearance";
import { isChromebookApp } from "./config/appFlavor";
import { isDesktopAppLayout } from "./lib/platform/desktopAppLayout";
import { isNativeMobileApp } from "./lib/platform/nativeAppLayout";
import { useI18n } from "./i18n/I18nProvider";
import { PwaInstallBanner } from "./components/pwa/PwaInstallBanner";
import { useHideBottomNavOnScroll } from "./hooks/useHideBottomNavOnScroll";
import { usePwaInstall } from "./hooks/usePwaInstall";
import { getAppBrandText } from "./lib/brand/appBrand";
import { LiveReader } from "./features/sources/LiveReader";
import { NovelReaderSkeleton, ReaderPagesSkeleton, VideoStageSkeleton } from "./components/ui/ContentSkeleton";

const LiveVideoPlayer = lazy(() => import("./features/sources/LiveVideoPlayer").then((module) => ({ default: module.LiveVideoPlayer })));

function ReaderSuspenseFallback({ manga }) {
  const { t } = useI18n();
  const mediaType = getItemType(manga);
  if (isVideoMediaType(mediaType)) {
    return (
      <div className="reader live-reader live-reader--video">
        <VideoStageSkeleton label={t("reader.loadingChapter")} />
      </div>
    );
  }
  if (mediaType === "novel") {
    return (
      <div className="reader live-reader live-reader--novel reader--theme-night reader--loading">
        <NovelReaderSkeleton label={t("reader.loadingChapter")} />
      </div>
    );
  }
  return (
    <div className="reader live-reader reader--loading">
      <ReaderPagesSkeleton label={t("reader.loadingChapter")} />
    </div>
  );
}

function FeatureSuspense({ children, fallback }) {
  const { t } = useI18n();
  return (
    <Suspense fallback={fallback || (
      <div className="boot-screen" role="status">
        <div className="boot-screen__inner">
          <p>{getAppBrandText(t).loading}</p>
        </div>
      </div>
    )}
    >
      {children}
    </Suspense>
  );
}

export function App() {
  const navigation = useAppNavigation();
  const preferences = useAppPreferences();
  const actions = useAppActionHandlers(preferences);
  const chapterFollow = useChapterFollow();
  const [rawSettings] = usePersistedState("mangashelf:settings", DEFAULT_APP_SETTINGS);
  const settings = normalizeSettings(rawSettings);
  const { pushToast } = useToast();
  const { t, dir } = useI18n();
  const brand = getAppBrandText(t);
  const desktopScrollerRef = useRef(null);
  const pwaInstall = usePwaInstall();
  const desktopLayout = isDesktopAppLayout();
  const nativeLayout = isNativeMobileApp();

  useEffect(() => {
    setRuntimeSettings(settings);
  }, [settings]);
  const {
    screen, selected, reader, selectedLive, liveReader,
    navigate, openManga, openReader, openLiveManga, openLiveReader, goBack, isOverlayOpen,
  } = navigation;
  const {
    favorites, liveFavorites, sources, activeSourceId, sourcePreferences,
    darkMode, appearance, typeface, setReaderProgress,
    getReadingProgress, saveReadingProgress,
    readingHistory,
    chapterReadLog,
  } = preferences;
  const {
    handleToggleFavorite,
    handleToggleLiveFavorite,
    handleToggleSite,
    handleSetSitesEnabled,
    handleSetSourceMode,
    handleToggleSourceSelection,
    handleSetActiveSourceId,
    handleSetAppearance,
    handleSetTypeface,
    handleRemoveReadingHistoryEntry,
    handleClearReadingHistory,
  } = actions;

  const handleNotificationOpen = useCallback((extra = {}) => {
    if (extra?.chapterUrl && extra?.url) {
      if (extra.feedId) chapterFollow.markFeedRead(extra.feedId);
      openLiveReader({
        url: extra.url,
        title: extra.title,
        altTitle: extra.altTitle,
        cover: extra.cover,
        sourceId: extra.sourceId,
        mediaType: extra.mediaType,
      }, {
        url: extra.chapterUrl,
        number: extra.chapterNumber,
        name: extra.chapterName,
      });
      return;
    }
    navigate("updates");
  }, [chapterFollow, navigate, openLiveReader]);

  useRealtimeFollowSync({
    chapterFollow,
    settings,
    pushToast,
    onNotificationOpen: handleNotificationOpen,
  });

  useBackgroundFollowTask(settings);

  const showMainBottomNav = !isOverlayOpen
    && screen !== "source-management"
    && screen !== "reading-history"
    && screen !== "notification-center"
    && !liveReader
    && !reader;

  useHideBottomNavOnScroll(showMainBottomNav);

  const liveReaderContent = liveReader ? (() => {
    const isVideo = isVideoMediaType(getItemType(liveReader.manga));
    const commonProps = {
      ...liveReader,
      onBack: goBack,
      onOpenDetails: () => openLiveManga(liveReader.manga),
      isFavorite: preferences.isLiveFavorite(liveReader.manga),
      onToggleFavorite: () => handleToggleLiveFavorite(liveReader.manga),
      onSaveProgress: saveReadingProgress,
    };
    const readerKey = `${liveReader.manga?.url || "live"}:${liveReader.chapter?.url || "chapter"}`;
    return isVideo
      ? (
        <FeatureSuspense fallback={<ReaderSuspenseFallback manga={liveReader.manga} />}>
          <LiveVideoPlayer key={readerKey} {...commonProps} />
        </FeatureSuspense>
      )
      : (
        <LiveReader
          key={readerKey}
          {...commonProps}
          readerSettings={settings}
        />
      );
  })() : null;

  if (liveReader && !desktopLayout) {
    return liveReaderContent;
  }

  if (reader) {
    return (
      <Reader
        {...reader}
        onBack={goBack}
        setProgress={setReaderProgress}
        onSaveProgress={saveReadingProgress}
      />
    );
  }

  const routeProps = {
    liveReaderContent,
    selectedLive,
    selected,
    screen,
    preferences,
    chapterFollow,
    navigation,
    actions,
    settings,
    appearance,
    typeface,
    sources,
    activeSourceId,
    sourcePreferences,
    favorites,
    liveFavorites,
    readingHistory,
    chapterReadLog,
  };

  const isYozakura = appearance === THEME_YOZAKURA;
  const isDaySakura = appearance === THEME_SAKURA;
  const isInk = appearance === THEME_INK;
  const isPaper = appearance === THEME_PAPER;
  const isGalaxy = isGalaxyTheme(appearance);

  const frameAtmosphere = (
    <>
      {isYozakura ? <YozakuraNight variant="frame" /> : null}
      {isDaySakura ? <SakuraDay variant="frame" /> : null}
      {isInk ? <InkAtmosphere variant="frame" /> : null}
      {isPaper ? <PaperAtmosphere variant="frame" /> : null}
      {isGalaxy ? <GalaxyAtmosphere variant="frame" /> : null}
      {isSnowTheme(appearance) ? <MoonSeaWater variant="frame" /> : null}
      {isSnowTheme(appearance) ? <MoonSnowfall variant="frame" /> : null}
    </>
  );

  const screenContent = (
    <FeatureSuspense>
      <AppRoutes {...routeProps} />
    </FeatureSuspense>
  );

  return (
    <div className={`app-shell ${darkMode ? "app-shell--dark" : ""} ${hasAtmosphereEffect(appearance) ? `app-shell--${appearance}` : ""} ${desktopLayout ? "app-shell--desktop" : ""}`} dir={dir}>
      {isYozakura ? <YozakuraNight variant="stage" /> : null}
      {isDaySakura ? <SakuraDay variant="stage" /> : null}
      {isInk ? <InkAtmosphere variant="stage" /> : null}
      {isPaper ? <PaperAtmosphere variant="stage" /> : null}
      {isGalaxy ? <GalaxyAtmosphere variant="stage" /> : null}
      {isSnowTheme(appearance) ? <MoonSeaWater variant="stage" /> : null}
      {isSnowTheme(appearance) ? <MoonSnowfall variant="stage" /> : null}
      {desktopLayout ? (
        <div className="desktop-shell">
          <DesktopMenu current={screen} navigate={navigate} appearance={appearance} />
          <div className="desktop-main">
            {isChromebookApp ? (
              <PwaInstallBanner
                canInstall={pwaInstall.canInstall}
                installed={pwaInstall.installed}
                dismissed={pwaInstall.dismissed}
                onInstall={pwaInstall.install}
                onDismiss={pwaInstall.dismiss}
              />
            ) : null}
            <div className="phone-frame-wrap">
              <div className="phone-frame" ref={desktopScrollerRef}>
                {frameAtmosphere}
                {screenContent}
              </div>
              <ThemedScrollbar scrollerRef={desktopScrollerRef} />
              {showMainBottomNav ? (
                <BottomNav current={screen} navigate={navigate} />
              ) : null}
            </div>
          </div>
        </div>
      ) : nativeLayout ? (
        <>
          <div className="phone-frame app-shell__view">
            {frameAtmosphere}
            {screenContent}
          </div>
          {showMainBottomNav ? (
            <BottomNav current={screen} navigate={navigate} />
          ) : null}
        </>
      ) : (
        <>
          <div className="desktop-note">
            <MnemeMark size={64} appearance={appearance} className="desktop-note__mark" decorative />
            {isSakuraTheme(appearance) ? (
              <>
                <span className="desktop-note__brand"><SakuraIcon size={14} decorative /> {t("app.kickerSakura")}</span>
                <h2>{t("app.nameSakura")}</h2>
              </>
            ) : (
              <>
                <span>{t("app.kicker")}</span>
                <AppBrandName as="h2" variant="desktop" lead={brand.nameLead} tail={brand.nameTail}>
                  {brand.name}
                </AppBrandName>
              </>
            )}
            <p>{t("app.tagline")}</p>
          </div>
          <div className="phone-frame">
            {frameAtmosphere}
            {screenContent}
            {showMainBottomNav ? (
              <BottomNav current={screen} navigate={navigate} />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
