import { useCallback } from "react";
import { getSourceProfile } from "../config/sources";
import { t } from "../i18n/runtime.js";
import { themeNameKey } from "../lib/theme/appearance";
import { typefaceNameKey } from "../lib/theme/typeface";
import { useToast } from "../components/ui/ToastProvider";

export function useAppActionHandlers(preferences) {
  const { pushToast } = useToast();
  const {
    favorites,
    liveFavorites,
    sources,
    sourcePreferences,
    toggleFavorite,
    toggleLiveFavorite,
    isLiveFavorite,
    toggleSite,
    setSitesEnabled,
    setSourceMode,
    toggleSourceSelection,
    setActiveSourceId,
    setAppearance,
    setTypeface,
    removeReadingHistoryEntry,
    clearReadingHistory,
  } = preferences;

  const handleToggleFavorite = useCallback((id) => {
    const adding = !favorites.includes(id);
    toggleFavorite(id);
    pushToast({
      type: "success",
      message: adding ? t("toast.addedFavorite") : t("toast.removedFavorite"),
    });
  }, [favorites, pushToast, toggleFavorite]);

  const handleToggleLiveFavorite = useCallback((item) => {
    const adding = !isLiveFavorite(item);
    toggleLiveFavorite(item);
    pushToast({
      type: "success",
      message: adding ? t("toast.addedFavorite") : t("toast.removedFavorite"),
    });
  }, [isLiveFavorite, pushToast, toggleLiveFavorite]);

  const handleToggleSite = useCallback((id) => {
    const source = sources.find((entry) => entry.id === id);
    const enabling = source?.enabled === false;
    if (!enabling && sources.filter((entry) => entry.enabled !== false).length <= 1) {
      pushToast({ type: "info", message: t("sources.keepOne") });
      return;
    }
    toggleSite(id);
    pushToast({
      type: "success",
      message: enabling ? t("toast.enabledSource", { name: getSourceProfile(id).name }) : t("toast.disabledSource", { name: getSourceProfile(id).name }),
    });
  }, [pushToast, sources, toggleSite]);

  const handleSetSitesEnabled = useCallback((ids, enabled) => {
    const uniqueIds = [...new Set(ids || [])];
    if (!uniqueIds.length) return;
    setSitesEnabled(uniqueIds, enabled);
    pushToast({
      type: "success",
      message: enabled ? t("toast.enabledVisible") : t("toast.disabledVisible"),
    });
  }, [pushToast, setSitesEnabled]);

  const handleSetSourceMode = useCallback((sourceId, mode) => {
    setSourceMode(sourceId, mode);
    pushToast({
      type: "success",
      message: mode === "full" ? t("toast.fullMode") : t("toast.selectedMode"),
    });
  }, [pushToast, setSourceMode]);

  const handleToggleSourceSelection = useCallback((sourceId, item) => {
    const preference = sourcePreferences[sourceId];
    const selected = preference?.selectedItems?.some((entry) => entry.url === item.url);
    toggleSourceSelection(sourceId, item);
    pushToast({
      type: "success",
      message: selected ? t("toast.removedPick") : t("toast.addedPick"),
    });
  }, [pushToast, sourcePreferences, toggleSourceSelection]);

  const handleSetActiveSourceId = useCallback((sourceId) => {
    setActiveSourceId(sourceId);
    pushToast({
      type: "success",
      message: t("toast.switchedSource", { name: getSourceProfile(sourceId).name }),
    });
  }, [pushToast, setActiveSourceId]);

  const handleSetAppearance = useCallback((themeId) => {
    setAppearance(themeId);
    pushToast({
      type: "success",
      message: t("toast.themeOn", { name: t(themeNameKey(themeId)) }),
    });
  }, [pushToast, setAppearance]);

  const handleSetTypeface = useCallback((fontId) => {
    setTypeface(fontId);
    pushToast({
      type: "success",
      message: t("toast.fontOn", { name: t(typefaceNameKey(fontId)) }),
    });
  }, [pushToast, setTypeface]);

  const handleSetDarkMode = useCallback((enabled) => {
    handleSetAppearance(enabled ? "ink" : "paper");
  }, [handleSetAppearance]);

  const handleRemoveReadingHistoryEntry = useCallback((key) => {
    removeReadingHistoryEntry(key);
    pushToast({ type: "success", message: t("toast.removedHistory") });
  }, [pushToast, removeReadingHistoryEntry]);

  const handleClearReadingHistory = useCallback(() => {
    clearReadingHistory();
    pushToast({ type: "success", message: t("toast.clearedHistory") });
  }, [clearReadingHistory, pushToast]);

  return {
    handleToggleFavorite,
    handleToggleLiveFavorite,
    handleToggleSite,
    handleSetSitesEnabled,
    handleSetSourceMode,
    handleToggleSourceSelection,
    handleSetActiveSourceId,
    handleSetDarkMode,
    handleSetAppearance,
    handleSetTypeface,
    handleRemoveReadingHistoryEntry,
    handleClearReadingHistory,
  };
}
