import React from "react";
import { SourceManagementScreen, SourcesScreen } from "../../features/sources";
import { LiveMangaDetails } from "../../features/sources/LiveMangaDetails";
import { LibraryScreen, SearchScreen, UpdatesScreen } from "../../screens/CollectionScreens";
import { ReadingHistoryScreen } from "../../screens/ReadingHistoryScreen";
import { DownloadsScreen } from "../../screens/DownloadsScreen";
import { MangaDetails } from "../../screens/DemoMangaScreens";
import { HomeScreen } from "../../screens/HomeScreen";
import { SettingsScreen } from "../../screens/SettingsScreen";
import { NotificationCenterScreen } from "../../screens/NotificationCenterScreen";

export function AppRoutes({
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
}) {
  const {
    navigate, openManga, openReader, openLiveManga, openLiveReader, goBack,
  } = navigation;
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

  if (liveReaderContent) return liveReaderContent;

  if (selectedLive) {
    return (
      <LiveMangaDetails
        key={selectedLive.url}
        seed={selectedLive}
        isFavorite={preferences.isLiveFavorite(selectedLive)}
        onToggleFavorite={handleToggleLiveFavorite}
        onBack={goBack}
        openLiveReader={openLiveReader}
        onOpenRelated={openLiveManga}
        readingProgress={preferences.getReadingProgress(selectedLive)}
        chapterFollow={chapterFollow}
        chapterReadLog={chapterReadLog}
      />
    );
  }

  if (selected) {
    return (
      <MangaDetails
        item={selected}
        isFavorite={favorites.includes(selected.id)}
        toggleFavorite={handleToggleFavorite}
        onBack={goBack}
        openReader={openReader}
        readingProgress={preferences.getReadingProgress(selected)}
      />
    );
  }

  if (screen === "source-catalog" || screen === "sources") {
    return (
      <SourcesScreen
        sources={sources}
        activeSourceId={activeSourceId}
        onSetActiveSource={handleSetActiveSourceId}
        sourcePreferences={sourcePreferences}
        openLiveManga={openLiveManga}
        openLiveChapter={openLiveReader}
        navigate={navigate}
      />
    );
  }

  if (screen === "updates") {
    return (
      <UpdatesScreen
        chapterFollow={chapterFollow}
        openLiveReader={openLiveReader}
        openLiveManga={openLiveManga}
        navigate={navigate}
      />
    );
  }

  if (screen === "favorites") {
    return (
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
    );
  }

  if (screen === "downloads") {
    return (
      <DownloadsScreen
        navigate={navigate}
        onBack={goBack}
        openLiveManga={openLiveManga}
        openLiveReader={openLiveReader}
      />
    );
  }

  if (screen === "reading-history") {
    return (
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
    );
  }

  if (screen === "notification-center") {
    return (
      <NotificationCenterScreen
        chapterFollow={chapterFollow}
        navigate={navigate}
        onBack={goBack}
        openLiveManga={openLiveManga}
      />
    );
  }

  if (screen === "settings") {
    return (
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
    );
  }

  if (screen === "source-management") {
    return (
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
    );
  }

  if (screen === "search") {
    return (
      <SearchScreen
        sources={sources}
        sourcePreferences={sourcePreferences}
        openLiveManga={openLiveManga}
        navigate={navigate}
      />
    );
  }

  return (
    <HomeScreen
      sources={sources}
      activeSourceId={activeSourceId}
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
  );
}
