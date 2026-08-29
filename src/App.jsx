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
import { SakuraPetals } from "./components/atmosphere/SakuraPetals";
import { SakuraBranches } from "./components/atmosphere/SakuraBranches";
import { MoonSnowfall } from "./components/atmosphere/MoonSnowfall";
import { SakuraIcon } from "./components/atmosphere/SakuraIcon";
import { MnemeMark } from "./components/brand/MnemeMark";
import { isSakuraTheme, isSnowTheme, hasAtmosphereEffect } from "./lib/theme/appearance";
import { isChromebookApp } from "./config/appFlavor";
import { isDesktopAppLayout } from "./lib/platform/desktopAppLayout";
import { useI18n } from "./i18n/I18nProvider";
import { PwaInstallBanner } from "./components/pwa/PwaInstallBanner";
import { usePwaInstall } from "./hooks/usePwaInstall";
import { getAppBrandText } from "./lib/brand/appBrand";

const LiveVideoPlayer = lazy(() => import("./features/sources/LiveVideoPlayer").then((module) => ({ default: module.LiveVideoPlayer })));
const LiveReader = lazy(() => import("./features/sources/LiveReader").then((module) => ({ default: module.LiveReader })));

function FeatureSuspense({ children }) {
  const { t } = useI18n();
  return (
    <Suspense fallback={(
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
  const desktopScrollerRef = useRef(null);
  const pwaInstall = usePwaInstall();
  const desktopLayout = isDesktopAppLayout();

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
        <FeatureSuspense>
          <LiveVideoPlayer key={readerKey} {...commonProps} />
        </FeatureSuspense>
      )
      : (
        <FeatureSuspense>
          <LiveReader
            key={readerKey}
            {...commonProps}
            readerSettings={settings}
          />
        </FeatureSuspense>
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

  const showMainBottomNav = !isOverlayOpen
    && screen !== "source-management"
    && screen !== "reading-history"
    && screen !== "notification-center"
    && !liveReaderContent;

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

  const frameAtmosphere = (
    <>
      {isSnowTheme(appearance) ? <MoonSnowfall variant="frame" /> : null}
      {isSakuraTheme(appearance) ? <SakuraBranches appearance={appearance} variant="frame" /> : null}
      {isSakuraTheme(appearance) ? <SakuraPetals appearance={appearance} variant="frame" /> : null}
    </>
  );

  const screenContent = (
    <FeatureSuspense>
      <AppRoutes {...routeProps} />
    </FeatureSuspense>
  );

  return (
    <div className={`app-shell ${darkMode ? "app-shell--dark" : ""} ${hasAtmosphereEffect(appearance) ? `app-shell--${appearance}` : ""} ${desktopLayout ? "app-shell--desktop" : ""}`} dir={dir}>
      {isSnowTheme(appearance) ? <MoonSnowfall variant="stage" /> : null}
      {isSakuraTheme(appearance) ? <SakuraBranches appearance={appearance} variant="stage" /> : null}
      {isSakuraTheme(appearance) ? <SakuraPetals appearance={appearance} variant="stage" /> : null}
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
              {isSakuraTheme(appearance) ? <SakuraBranches appearance={appearance} variant="bottom" /> : null}
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
                <h2>{t("app.name")}</h2>
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
