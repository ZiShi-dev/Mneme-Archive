import { useCallback, useMemo, useRef, useState } from "react";
import { getItemType } from "../features/sources/contentTypes";
import { usePersistedState } from "./usePersistedState";
import { buildFollowItem, getFollowKey } from "../lib/updates/followKeys";
import { normalizeFollowPreference } from "../lib/updates/followPolicy";
import { syncAllFollowedTitles } from "../lib/updates/updatesSync";
import { showChapterUpdateNotifications } from "../lib/notifications/pushNotifications";
import { getRuntimeSettings } from "../lib/settings/runtimeSettings";
import { t } from "../i18n/runtime.js";

const MAX_FEED_ITEMS = 120;
const SYNC_TIMEOUT_MS = 45_000;

function withTimeout(promise, timeoutMs = SYNC_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(t("toast.followTimeout"))), timeoutMs);
    }),
  ]);
}

export function useChapterFollow() {
  const [preferences, setPreferences] = usePersistedState("living-archive:follow-preferences", {});
  const [snapshots, setSnapshots] = usePersistedState("living-archive:follow-snapshots", {});
  const [feed, setFeed] = usePersistedState("living-archive:updates-feed", []);
  const [lastSyncAt, setLastSyncAt] = usePersistedState("living-archive:updates-last-sync", null);
  const [syncing, setSyncing] = useState(false);
  const syncLockRef = useRef(false);
  const preferencesRef = useRef(preferences);
  const snapshotsRef = useRef(snapshots);

  preferencesRef.current = preferences;
  snapshotsRef.current = snapshots;

  const followedCount = useMemo(
    () => Object.values(preferences).filter((entry) => entry?.enabled !== false).length,
    [preferences],
  );

  const unreadCount = useMemo(
    () => feed.filter((entry) => !entry.read).length,
    [feed],
  );

  const getPreference = useCallback(
    (item) => normalizeFollowPreference(preferences[getFollowKey(item)]),
    [preferences],
  );

  const savePreference = useCallback((item, partial, baselineChapter = null) => {
    const key = getFollowKey(item);
    const base = buildFollowItem({ ...item, mediaType: getItemType(item) });
    setPreferences((current) => ({
      ...current,
      [key]: normalizeFollowPreference({
        ...base,
        ...current[key],
        ...partial,
        enabled: partial.enabled ?? true,
        updatedAt: new Date().toISOString(),
      }, partial.interval ?? current[key]?.interval ?? 1),
    }));

    if (baselineChapter?.url) {
      setSnapshots((current) => {
        if (current[key]?.chapterUrl) return current;
        const chapterNumber = baselineChapter.number ?? baselineChapter.name ?? "";
        return {
          ...current,
          [key]: {
            chapterUrl: baselineChapter.url,
            chapterNumber: String(chapterNumber),
            chapterName: baselineChapter.name || String(chapterNumber),
            lastAnnouncedNumber: Number(chapterNumber) || 0,
            checkedAt: new Date().toISOString(),
          },
        };
      });
    }
  }, [setPreferences, setSnapshots]);

  const removePreference = useCallback((item) => {
    const key = getFollowKey(item);
    setPreferences((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setSnapshots((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, [setPreferences, setSnapshots]);

  const syncFollowed = useCallback(async ({ silent = false } = {}) => {
    if (syncLockRef.current) {
      return { events: [], errors: [], skipped: true };
    }

    syncLockRef.current = true;
    if (!silent) setSyncing(true);

    try {
      const result = await withTimeout(
        syncAllFollowedTitles(preferencesRef.current, snapshotsRef.current),
      );
      if (result.snapshots) setSnapshots(result.snapshots);
      if (result.events.length) {
        setFeed((current) => [...result.events, ...current].slice(0, MAX_FEED_ITEMS));
        if (getRuntimeSettings().notifications) {
          try {
            await showChapterUpdateNotifications(result.events);
          } catch {
            // Notifications optionnelles.
          }
        }
      }
      setLastSyncAt(new Date().toISOString());
      return result;
    } catch (error) {
      return {
        events: [],
        errors: [{
          key: "sync",
          message: error instanceof Error ? error.message : t("updates.checkFailed"),
        }],
      };
    } finally {
      syncLockRef.current = false;
      if (!silent) setSyncing(false);
    }
  }, [setFeed, setLastSyncAt, setSnapshots]);

  const markFeedRead = useCallback((id) => {
    setFeed((current) => current.map((entry) => (entry.id === id ? { ...entry, read: true } : entry)));
  }, [setFeed]);

  const markAllFeedRead = useCallback(() => {
    setFeed((current) => current.map((entry) => ({ ...entry, read: true })));
  }, [setFeed]);

  const removeFeedEntry = useCallback((id) => {
    setFeed((current) => current.filter((entry) => entry.id !== id));
  }, [setFeed]);

  return {
    preferences,
    feed,
    followedCount,
    unreadCount,
    lastSyncAt,
    syncing,
    getPreference,
    savePreference,
    removePreference,
    syncFollowed,
    markFeedRead,
    markAllFeedRead,
    removeFeedEntry,
  };
}
