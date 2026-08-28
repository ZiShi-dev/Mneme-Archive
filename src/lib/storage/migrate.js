import { isAllowedStorageKey } from "./security";
import { kvGet, kvSet, kvHasSync } from "./kvStore";
import { STORAGE_META_MIGRATED } from "./constants";

const LEGACY_KEYS = [
  "mangashelf:favorites",
  "living-archive:live-favorites",
  "mangashelf:v4:sources",
  "living-archive:active-source",
  "living-archive:v5:source-preferences",
  "living-archive:ink-mode",
  "living-archive:appearance",
  "living-archive:typeface",
  "living-archive:reading-history",
  "living-archive:chapter-read-log",
  "mangashelf:reader-progress",
  "mangashelf:settings",
  "living-archive:reader-preferences",
  "living-archive:follow-preferences",
  "living-archive:follow-snapshots",
  "living-archive:updates-feed",
  "living-archive:updates-last-sync",
];

function collectLegacyKeys() {
  if (typeof localStorage === "undefined") return [];
  const keys = [...LEGACY_KEYS];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("living-archive:chapter-progress:") && isAllowedStorageKey(key)) {
      keys.push(key);
    }
  }
  return keys;
}

export async function migrateFromLegacyLocalStorage() {
  if (kvHasSync(STORAGE_META_MIGRATED)) return;
  if (typeof localStorage === "undefined") {
    await kvSet(STORAGE_META_MIGRATED, true);
    return;
  }

  const keys = collectLegacyKeys();
  await Promise.all(keys.map(async (key) => {
    if (kvHasSync(key)) return;
    const raw = localStorage.getItem(key);
    if (raw == null) return;
    await kvSet(key, raw);
  }));

  await kvSet(STORAGE_META_MIGRATED, true);
}
