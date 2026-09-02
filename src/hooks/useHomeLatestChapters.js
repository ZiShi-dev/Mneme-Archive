import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMeteredNetworkLimits, allowsHomeAutoUpdates } from "../lib/platform/dataSaver";
import { refreshNetworkStatus } from "../lib/platform/networkStatus";
import {
  collectHomeTrackedItems,
  hydrateHomeLatestChapters,
  loadHomeLatestChapters,
  peekHomeLatestChapters,
} from "../lib/updates/homeLatestChapters";
import { getItemType } from "../features/sources/contentTypes";
import { t } from "../i18n/runtime.js";

function readHomeLatestState({ followPreferences, readingHistory, mediaFilter, settings }) {
  const { homeLatestLimit } = getMeteredNetworkLimits(settings);
  const tracked = collectHomeTrackedItems(followPreferences)
    .filter((item) => mediaFilter === "all" || getItemType(item) === mediaFilter);
  const cached = peekHomeLatestChapters({
    mediaFilter,
    trackedCount: tracked.length,
    limit: homeLatestLimit,
  });
  if (cached) return cached;
  return hydrateHomeLatestChapters({
    followPreferences,
    readingHistory,
    mediaFilter,
    limit: homeLatestLimit,
  });
}

export function useHomeLatestChapters({
  followPreferences,
  readingHistory,
  mediaFilter = "all",
  settings = {},
}) {
  const [entries, setEntries] = useState(() => (
    readHomeLatestState({ followPreferences, readingHistory, mediaFilter, settings }).entries
  ));
  const [trackedCount, setTrackedCount] = useState(() => (
    readHomeLatestState({ followPreferences, readingHistory, mediaFilter, settings }).trackedCount
  ));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pausedForData, setPausedForData] = useState(false);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async ({ silent = false, force = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!silent) setLoading(true);
    setError("");
    setPausedForData(false);

    try {
      await refreshNetworkStatus();
      const { homeLatestLimit, homeLatestConcurrency } = getMeteredNetworkLimits(settings);

      const result = await loadHomeLatestChapters({
        followPreferences,
        readingHistory,
        mediaFilter,
        limit: homeLatestLimit,
        concurrency: homeLatestConcurrency,
        skipCache: force,
      });

      if (requestIdRef.current !== requestId) return result;
      setEntries(result.entries);
      setTrackedCount(result.trackedCount);
      return result;
    } catch (reason) {
      if (requestIdRef.current !== requestId) return { entries: [], trackedCount: 0 };
      const message = reason instanceof Error ? reason.message : t("toast.latestFailed");
      setError(message);
      return { entries: [], trackedCount: 0 };
    } finally {
      if (requestIdRef.current === requestId && !silent) setLoading(false);
    }
  }, [followPreferences, mediaFilter, readingHistory, settings]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const hydrated = readHomeLatestState({
        followPreferences,
        readingHistory,
        mediaFilter,
        settings,
      });
      if (!cancelled) {
        setEntries(hydrated.entries);
        setTrackedCount(hydrated.trackedCount);
      }

      await refreshNetworkStatus();
      if (!allowsHomeAutoUpdates(settings)) {
        if (!cancelled) {
          setPausedForData(hydrated.trackedCount > 0 && !hydrated.entries.length);
          setError("");
        }
        return;
      }

      if (!cancelled) {
        await refresh({ silent: true });
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
      requestIdRef.current += 1;
    };
  }, [followPreferences, mediaFilter, readingHistory, refresh, settings]);

  const newCount = useMemo(
    () => entries.filter((entry) => entry.isNew).length,
    [entries],
  );

  return {
    entries,
    trackedCount,
    loading,
    error,
    pausedForData,
    refresh,
    newCount,
  };
}
