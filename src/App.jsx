import React, { Suspense, lazy, useCallback, useEffect, useRef } from "react";
import { BottomNav, DesktopMenu } from "./components/layout/BottomNav";
import { ThemedScrollbar } from "./components/layout/ThemedScrollbar";
import { useToast } from "./components/ui/ToastProvider";
import { SourceManagementScreen, SourcesScreen } from "./features/sources";
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
import { LibraryScreen, SearchScreen, UpdatesScreen } from "./screens/CollectionScreens";
import { ReadingHistoryScreen } from "./screens/ReadingHistoryScreen";
import { MangaDetails, Reader } from "./screens/DemoMangaScreens";
import { HomeScreen } from "./screens/HomeScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { NotificationCenterScreen } from "./screens/NotificationCenterScreen";
import { getItemType } from "./features/sources/contentTypes";
import { isVideoMediaType } from "./features/sources/mediaPresentation";
import { SakuraPetals } from "./components/atmosphere/SakuraPetals";
import { MoonSnowfall } from "./components/atmosphere/MoonSnowfall";
import { SakuraIcon } from "./components/atmosphere/SakuraIcon";
import { MnemeMark } from "./components/brand/MnemeMark";
import { isSakuraTheme, isSnowTheme, hasAtmosphereEffect } from "./lib/theme/appearance";
import { isChromebookApp } from "./config/appFlavor";
import { useI18n } from "./i18n/I18nProvider";
import { PwaInstallBanner } from "./components/pwa/PwaInstallBanner";
import { usePwaInstall } from "./hooks/usePwaInstall";
import { getAppBrandText } from "./lib/brand/appBrand";

const LiveVideoPlayer = lazy(() => import("./features/sources/LiveVideoPlayer").then((module) => ({ default: module.LiveVideoPlayer })));
const LiveReader = lazy(() => import("./features/sources/LiveReader").then((module) => ({ default: module.LiveReader })));
const LiveMangaDetails = lazy(() => import("./features/sources/LiveMangaDetails").then((module) => ({ default: module.LiveMangaDetails })));

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

  if (liveReader && !isChromebookApp) {
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

  return (
    <div className={`app-shell ${darkMode ? "app-shell--dark" : ""} ${hasAtmosphereEffect(appearance) ? `app-shell--${appearance}` : ""} ${isChromebookApp ? "app-shell--desktop" : ""}`} dir={dir}>
      {isSnowTheme(appearance) ? <MoonSnowfall variant="stage" /> : null}
      {isSakuraTheme(appearance) ? <SakuraPetals appearance={appearance} variant="stage" /> : null}
      {isChromebookApp ? (
        <div className="desktop-shell">
          <DesktopMenu current={screen} navigate={navigate} appearance={appearance} />
          <div className="desktop-main">
            <PwaInstallBanner
              canInstall={pwaInstall.canInstall}
              installed={pwaInstall.installed}
              dismissed={pwaInstall.dismissed}
              onInstall={pwaInstall.install}
              onDismiss={pwaInstall.dismiss}
            />
            <div className="phone-frame-wrap">
              <div className="phone-frame" ref={desktopScrollerRef}>
                {isSnowTheme(appearance) ? <MoonSnowfall variant="frame" /> : null}
                {isSakuraTheme(appearance) ? <SakuraPetals appearance={appearance} variant="frame" /> : null}
                {liveReaderContent ?? (selectedLive ? (
                  <FeatureSuspense>
                    <LiveMangaDetails
                      key={selectedLive.url}
                      seed={selectedLive}
                      isFavorite={preferences.isLiveFavorite(selectedLive)}
                      onToggleFavorite={handleToggleLiveFavorite}
                      onBack={goBack}
                      openLiveReader={openLiveReader}
                      onOpenRelated={openLiveManga}
                      readingProgress={getReadingProgress(selectedLive)}
                      chapterFollow={chapterFollow}
                    />
                  </FeatureSuspense>
                ) : selected ? (
                  <MangaDetails
                    item={selected}
                    isFavorite={favorites.includes(selected.id)}
                    toggleFavorite={handleToggleFavorite}
                    onBack={goBack}
                    openReader={openReader}
                    readingProgress={getReadingProgress(selected)}
                  />
                ) : screen === "source-catalog" || screen === "sources" ? (
                  <SourcesScreen
                    sources={sources}
                    activeSourceId={activeSourceId}
                    onSetActiveSource={handleSetActiveSourceId}
                    sourcePreferences={sourcePreferences}
                    openLiveManga={openLiveManga}
                    openLiveChapter={openLiveReader}
                    navigate={navigate}
                  />
                ) : screen === "updates" ? (
                  <UpdatesScreen
                    chapterFollow={chapterFollow}
                    openLiveReader={openLiveReader}
                    openLiveManga={openLiveManga}
                    navigate={navigate}
                  />
                ) : screen === "favorites" ? (
                  <LibraryScreen
                    favorites={favorites}
                    liveFavorites={liveFavorites}
                    toggleFavorite={handleToggleFavorite}
                    toggleLiveFavorite={handleToggleLiveFavorite}
                    openManga={openManga}
                    openLiveManga={openLiveManga}
                    openLiveChapter={openLiveReader}
                    navigate={navigate}
                  />
                ) : screen === "reading-history" ? (
                  <ReadingHistoryScreen
                    readingHistory={readingHistory}
                    chapterReadLog={chapterReadLog}
                    liveFavorites={liveFavorites}
                    navigate={navigate}
                    onBack={goBack}
                    openManga={openManga}
                    openLiveManga={openLiveManga}
                    openReader={openReader}
                    openLiveReader={openLiveReader}
                    onRemoveEntry={handleRemoveReadingHistoryEntry}
                    onClearHistory={handleClearReadingHistory}
                  />
                ) : screen === "notification-center" ? (
                  <NotificationCenterScreen
                    chapterFollow={chapterFollow}
                    navigate={navigate}
                    onBack={goBack}
                    openLiveManga={openLiveManga}
                  />
                ) : screen === "settings" ? (
                  <SettingsScreen
                    navigate={navigate}
                    appearance={appearance}
                    typeface={typeface}
                    onSetAppearance={handleSetAppearance}
                    onSetTypeface={handleSetTypeface}
                    sources={sources}
                    sourcePreferences={sourcePreferences}
                    onToggleSite={handleToggleSite}
                    onSetSitesEnabled={handleSetSitesEnabled}
                  />
                ) : screen === "source-management" ? (
                  <SourceManagementScreen
                    sources={sources}
                    sourcePreferences={sourcePreferences}
                    navigate={navigate}
                    onBack={goBack}
                    onToggleSite={handleToggleSite}
                    onSetSitesEnabled={handleSetSitesEnabled}
                    onSetSourceMode={handleSetSourceMode}
                    onToggleSelection={handleToggleSourceSelection}
                  />
                ) : screen === "search" ? (
                  <SearchScreen
                    sources={sources}
                    sourcePreferences={sourcePreferences}
                    openLiveManga={openLiveManga}
                    navigate={navigate}
                  />
                ) : (
                  <HomeScreen
                    sources={sources}
                    sourcePreferences={sourcePreferences}
                    readingHistory={readingHistory}
                    liveFavorites={liveFavorites}
                    followPreferences={chapterFollow.preferences}
                    openManga={openManga}
                    openReader={openReader}
                    openLiveManga={openLiveManga}
                    openLiveReader={openLiveReader}
                    navigate={navigate}
                    settings={settings}
                    appearance={appearance}
                  />
                ))}
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
            {isSnowTheme(appearance) ? <MoonSnowfall variant="frame" /> : null}
            {isSakuraTheme(appearance) ? <SakuraPetals appearance={appearance} variant="frame" /> : null}
            {liveReaderContent ?? (selectedLive ? (
              <FeatureSuspense>
                <LiveMangaDetails
                  key={selectedLive.url}
                  seed={selectedLive}
                  isFavorite={preferences.isLiveFavorite(selectedLive)}
                  onToggleFavorite={handleToggleLiveFavorite}
                  onBack={goBack}
                  openLiveReader={openLiveReader}
                  onOpenRelated={openLiveManga}
                  readingProgress={getReadingProgress(selectedLive)}
                  chapterFollow={chapterFollow}
                />
              </FeatureSuspense>
            ) : selected ? (
              <MangaDetails
                item={selected}
                isFavorite={favorites.includes(selected.id)}
                toggleFavorite={handleToggleFavorite}
                onBack={goBack}
                openReader={openReader}
                readingProgress={getReadingProgress(selected)}
              />
            ) : screen === "source-catalog" || screen === "sources" ? (
              <SourcesScreen
                sources={sources}
                activeSourceId={activeSourceId}
                onSetActiveSource={handleSetActiveSourceId}
                sourcePreferences={sourcePreferences}
                openLiveManga={openLiveManga}
                openLiveChapter={openLiveReader}
                navigate={navigate}
              />
            ) : screen === "updates" ? (
              <UpdatesScreen
                chapterFollow={chapterFollow}
                openLiveReader={openLiveReader}
                openLiveManga={openLiveManga}
                navigate={navigate}
              />
            ) : screen === "favorites" ? (
              <LibraryScreen
                favorites={favorites}
                liveFavorites={liveFavorites}
                toggleFavorite={handleToggleFavorite}
                toggleLiveFavorite={handleToggleLiveFavorite}
                openManga={openManga}
                openLiveManga={openLiveManga}
                openLiveChapter={openLiveReader}
                navigate={navigate}
              />
            ) : screen === "reading-history" ? (
              <ReadingHistoryScreen
                readingHistory={readingHistory}
                chapterReadLog={chapterReadLog}
                liveFavorites={liveFavorites}
                navigate={navigate}
                onBack={goBack}
                openManga={openManga}
                openLiveManga={openLiveManga}
                openReader={openReader}
                openLiveReader={openLiveReader}
                onRemoveEntry={handleRemoveReadingHistoryEntry}
                onClearHistory={handleClearReadingHistory}
              />
            ) : screen === "notification-center" ? (
              <NotificationCenterScreen
                chapterFollow={chapterFollow}
                navigate={navigate}
                onBack={goBack}
                openLiveManga={openLiveManga}
              />
            ) : screen === "settings" ? (
              <SettingsScreen
                navigate={navigate}
                appearance={appearance}
                typeface={typeface}
                onSetAppearance={handleSetAppearance}
                onSetTypeface={handleSetTypeface}
                sources={sources}
                sourcePreferences={sourcePreferences}
                onToggleSite={handleToggleSite}
                onSetSitesEnabled={handleSetSitesEnabled}
              />
            ) : screen === "source-management" ? (
              <SourceManagementScreen
                sources={sources}
                sourcePreferences={sourcePreferences}
                navigate={navigate}
                onBack={goBack}
                onToggleSite={handleToggleSite}
                onSetSitesEnabled={handleSetSitesEnabled}
                onSetSourceMode={handleSetSourceMode}
                onToggleSelection={handleToggleSourceSelection}
              />
            ) : screen === "search" ? (
              <SearchScreen
                sources={sources}
                sourcePreferences={sourcePreferences}
                openLiveManga={openLiveManga}
                navigate={navigate}
              />
            ) : (
              <HomeScreen
                sources={sources}
                sourcePreferences={sourcePreferences}
                readingHistory={readingHistory}
                liveFavorites={liveFavorites}
                followPreferences={chapterFollow.preferences}
                openManga={openManga}
                openReader={openReader}
                openLiveManga={openLiveManga}
                openLiveReader={openLiveReader}
                navigate={navigate}
                settings={settings}
                appearance={appearance}
              />
            ))}
            {showMainBottomNav ? (
              <BottomNav current={screen} navigate={navigate} />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
