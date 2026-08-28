import { useCallback, useEffect, useRef, useState } from "react";
import { getMeteredNetworkLimits, allowsHeavyNetworkUse, allowsHomeAutoUpdates } from "../lib/platform/dataSaver";
import { refreshNetworkStatus } from "../lib/platform/networkStatus";
import {
  collectHomeTrackedItems,
  loadHomeLatestChapters,
} from "../lib/updates/homeLatestChapters";
import { getItemType } from "../features/sources/contentTypes";
import { t } from "../i18n/runtime.js";

export function useHomeLatestChapters({
  followPreferences,
  readingHistory,
  mediaFilter = "all",
  settings = {},
}) {
  const [entries, setEntries] = useState([]);
  const [trackedCount, setTrackedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pausedForData, setPausedForData] = useState(false);
  const requestIdRef = useRef(0);

  const resolveTrackedCount = useCallback(() => {
    return collectHomeTrackedItems(followPreferences)
      .filter((item) => mediaFilter === "all" || getItemType(item) === mediaFilter)
      .length;
  }, [followPreferences, mediaFilter]);

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
      const count = resolveTrackedCount();
      setTrackedCount(count);

      await refreshNetworkStatus();
      if (!allowsHomeAutoUpdates(settings)) {
        if (!cancelled) {
          setPausedForData(count > 0);
          setEntries([]);
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
    };
  }, [refresh, resolveTrackedCount, settings, settings?.homeAutoUpdates, settings?.wifi]);

  return {
    entries,
    trackedCount,
    loading,
    error,
    pausedForData,
    refresh,
    newCount: entries.filter((entry) => entry.isNew).length,
  };
}
