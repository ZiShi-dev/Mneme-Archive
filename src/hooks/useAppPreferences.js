import { useEffect, useMemo } from "react";
import { DEFAULT_SOURCE_ID, isChromebookApp } from "../config/appFlavor";
import {
  initialSourcePreferences,
  initialSources,
  isKnownSourceId,
  REMOVED_SOURCE_IDS,
  resolveSourceId,
  sanitizeActiveSourceId,
  sanitizeSourcesList,
} from "../config/sources";
import {
  buildReadingRecord,
  getTitleReadingKey,
  mergeReadingRecord,
  normalizeReadingRecord,
} from "../lib/readingProgress";
import {
  removeTitleChapterLog,
  upsertChapterReadLog,
} from "../lib/reading/chapterReadLog";
import { resolveBookmarkType } from "../features/sources/contentTypes";
import { applyRecentChapterFields, recentChaptersFromList } from "../../server/lib/catalogChapters.js";
import { applyAppearance, isDarkTheme, normalizeThemeId, THEME_INK } from "../lib/theme/appearance";
import { applyTypeface, FONT_SANS, normalizeTypefaceId } from "../lib/theme/typeface";
import { usePersistedState } from "./usePersistedState";
import { clearReadingData } from "../lib/storage/clearLocalData.js";

export function useAppPreferences() {
  const [favorites, setFavorites] = usePersistedState("mangashelf:favorites", []);
  const [liveFavorites, setLiveFavorites] = usePersistedState("living-archive:live-favorites", []);
  const [sources, setSources] = usePersistedState("mangashelf:v4:sources", initialSources);
  const [activeSourceId, setActiveSourceId] = usePersistedState("living-archive:active-source", DEFAULT_SOURCE_ID);
  const [sourcePreferences, setSourcePreferences] = usePersistedState("living-archive:v5:source-preferences", initialSourcePreferences);
  const [legacyInkMode] = usePersistedState("living-archive:ink-mode", true);
  const [appearanceRaw, setAppearanceRaw] = usePersistedState("living-archive:appearance", THEME_INK);
  const [typefaceRaw, setTypefaceRaw] = usePersistedState("living-archive:typeface", FONT_SANS);
  const [readingHistory, setReadingHistory] = usePersistedState("living-archive:reading-history", {});
  const [chapterReadLog, setChapterReadLog] = usePersistedState("living-archive:chapter-read-log", {});
  const [, setReaderProgress] = usePersistedState("mangashelf:reader-progress", 0);

  const appearance = normalizeThemeId(appearanceRaw ?? legacyInkMode);
  const typeface = normalizeTypefaceId(typefaceRaw);
  const darkMode = isDarkTheme(appearance);
  const setAppearance = (next) => setAppearanceRaw(normalizeThemeId(next));
  const setTypeface = (next) => setTypefaceRaw(normalizeTypefaceId(next));
  const setDarkMode = (enabled) => setAppearance(enabled ? "ink" : "paper");

  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  useEffect(() => {
    applyTypeface(typeface);
  }, [typeface]);

  useEffect(() => {
    setLiveFavorites((current) => {
      if (!current.length) return current;
      let changed = false;
      const next = current.map((item) => {
        const mediaType = resolveBookmarkType(item);
        if (item.mediaType === mediaType) return item;
        changed = true;
        return { ...item, mediaType };
      });
      return changed ? next : current;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSources((current) => sanitizeSourcesList(current));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSourcePreferences((current) => {
      let changed = false;
      const next = { ...current };
      for (const sourceId of REMOVED_SOURCE_IDS) {
        if (sourceId in next) {
          delete next[sourceId];
          changed = true;
        }
      }
      for (const key of Object.keys(next)) {
        if (!isKnownSourceId(key)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : current;
    });

    setLiveFavorites((current) => {
      if (!current.length) return current;
      const next = current.filter((item) => isKnownSourceId(resolveSourceId(item)));
      return next.length === current.length ? current : next;
    });

    setActiveSourceId((current) => (isKnownSourceId(current) ? current : DEFAULT_SOURCE_ID));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isKnownSourceId(activeSourceId) || !sources.some((entry) => entry.id === activeSourceId && entry.enabled !== false)) {
      const next = sources.find((entry) => entry.enabled !== false && isKnownSourceId(entry.id))?.id || DEFAULT_SOURCE_ID;
      if (next && next !== activeSourceId) setActiveSourceId(next);
    }
  }, [activeSourceId, setActiveSourceId, sources]);

  const liveFavoriteKey = (item) => `${resolveSourceId(item)}:${item.url}`;
  const isLiveFavorite = (item) => liveFavorites.some((favorite) => liveFavoriteKey(favorite) === liveFavoriteKey(item));

  const toggleFavorite = (id) => setFavorites((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  const toggleLiveFavorite = (item) => setLiveFavorites((current) => {
    const key = liveFavoriteKey(item);
    if (current.some((favorite) => liveFavoriteKey(favorite) === key)) {
      return current.filter((favorite) => liveFavoriteKey(favorite) !== key);
    }
    const sourceId = resolveSourceId(item);
    return [...current, {
      url: item.url,
      title: item.title,
      altTitle: item.altTitle || item.subtitle || "",
      cover: item.cover,
      sourceId,
      mediaType: resolveBookmarkType(item),
      mediaTypeLabel: item.mediaTypeLabel,
      ...applyRecentChapterFields({ ...item, sourceId }, item.recentChapters?.length
        ? item.recentChapters
        : recentChaptersFromList(item.chapters, undefined, { sourceId })),
    }];
  });

  const toggleSite = (id) => setSources((current) => {
    const target = current.find((source) => source.id === id);
    if (!target) return current;
    const enabling = target.enabled === false;
    if (!enabling && current.filter((source) => source.enabled !== false).length <= 1) return current;
    return current.map((source) => (source.id === id ? { ...source, enabled: enabling } : source));
  });

  const setSitesEnabled = (ids, enabled) => setSources((current) => {
    const idSet = new Set(ids);
    if (!idSet.size) return current;
    let next = current.map((source) => (idSet.has(source.id) ? { ...source, enabled: Boolean(enabled) } : source));
    if (!next.some((source) => source.enabled !== false)) {
      const keepId = current.find((source) => source.enabled !== false)?.id || next[0]?.id;
      next = next.map((source) => (source.id === keepId ? { ...source, enabled: true } : source));
    }
    return next;
  });

  const setSourceMode = (sourceId, mode) => setSourcePreferences((current) => ({
    ...initialSourcePreferences,
    ...current,
    [sourceId]: { ...initialSourcePreferences[sourceId], ...current[sourceId], mode },
  }));

  const toggleSourceSelection = (sourceId, item) => setSourcePreferences((current) => {
    const preference = { ...initialSourcePreferences[sourceId], ...current[sourceId] };
    const selectedItems = preference.selectedItems.some((entry) => entry.url === item.url)
      ? preference.selectedItems.filter((entry) => entry.url !== item.url)
      : [...preference.selectedItems, { ...item, sourceId }];
    return { ...initialSourcePreferences, ...current, [sourceId]: { ...preference, selectedItems } };
  });

  const getReadingProgress = (item) => normalizeReadingRecord(readingHistory[getTitleReadingKey(item)] || null);

  const saveReadingProgress = (item, chapter, progress, options = {}) => {
    const key = getTitleReadingKey(item);
    const next = {
      ...buildReadingRecord(item, chapter, progress, options),
      mediaType: resolveBookmarkType(item),
    };
    setReadingHistory((current) => ({
      ...current,
      [key]: mergeReadingRecord(current[key], next),
    }));
    setChapterReadLog((current) => upsertChapterReadLog(current, key, next));
  };

  const removeReadingHistoryEntry = (key) => {
    setReadingHistory((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setChapterReadLog((current) => removeTitleChapterLog(current, key));
  };

  const clearReadingHistory = () => {
    setReadingHistory({});
    setChapterReadLog({});
    setReaderProgress(0);
    void clearReadingData();
  };

  const visibleSources = useMemo(() => sanitizeSourcesList(sources), [sources]);
  const safeActiveSourceId = useMemo(
    () => sanitizeActiveSourceId(activeSourceId, visibleSources),
    [activeSourceId, visibleSources],
  );

  return {
    favorites,
    liveFavorites,
    sources: visibleSources,
    activeSourceId: safeActiveSourceId,
    setActiveSourceId,
    sourcePreferences,
    darkMode,
    appearance,
    typeface,
    setDarkMode,
    setAppearance,
    setTypeface,
    setReaderProgress,
    toggleFavorite,
    isLiveFavorite,
    toggleLiveFavorite,
    toggleSite,
    setSitesEnabled,
    setSourceMode,
    toggleSourceSelection,
    readingHistory,
    chapterReadLog,
    getReadingProgress,
    saveReadingProgress,
    removeReadingHistoryEntry,
    clearReadingHistory,
  };
}
