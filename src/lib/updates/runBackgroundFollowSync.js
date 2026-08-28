import { initStorage } from "../storage/initStorage";
import { kvGet, kvSet } from "../storage/kvStore";
import { allowsHeavyNetworkUse } from "../platform/dataSaver";
import { refreshNetworkStatus } from "../platform/networkStatus";
import { syncAllFollowedTitles } from "./updatesSync";

const MAX_FEED_ITEMS = 120;

const STORAGE_KEYS = {
  preferences: "living-archive:follow-preferences",
  snapshots: "living-archive:follow-snapshots",
  feed: "living-archive:updates-feed",
  lastSync: "living-archive:updates-last-sync",
  settings: "mangashelf:settings",
};

export async function runBackgroundFollowSync() {
  await initStorage();

  const settings = await kvGet(STORAGE_KEYS.settings, {
    notifications: true,
    backgroundSync: true,
  });

  if (!settings.notifications || settings.backgroundSync === false) {
    return { events: [], errors: [], skipped: true };
  }

  await refreshNetworkStatus();
  if (!allowsHeavyNetworkUse(settings)) {
    return { events: [], errors: [], skipped: true, reason: "metered" };
  }

  const preferences = await kvGet(STORAGE_KEYS.preferences, {});
  const snapshots = await kvGet(STORAGE_KEYS.snapshots, {});
  const followedCount = Object.values(preferences).filter((entry) => entry?.enabled !== false).length;

  if (!followedCount) {
    return { events: [], errors: [], skipped: true };
  }

  const result = await syncAllFollowedTitles(preferences, snapshots);

  if (result.snapshots) {
    await kvSet(STORAGE_KEYS.snapshots, result.snapshots);
  }

  if (result.events?.length) {
    const feed = await kvGet(STORAGE_KEYS.feed, []);
    await kvSet(STORAGE_KEYS.feed, [...result.events, ...feed].slice(0, MAX_FEED_ITEMS));
  }

  await kvSet(STORAGE_KEYS.lastSync, new Date().toISOString());
  return result;
}
