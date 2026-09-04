import { getNetworkStatus, isWifiLikeConnection } from "./networkStatus.js";
import { getRuntimeSettings } from "../settings/runtimeSettings.js";

function isBrowserSaveDataEnabled() {
  if (typeof navigator === "undefined") return false;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return Boolean(connection?.saveData);
}

export function isMeteredConnection() {
  const { connected } = getNetworkStatus();
  if (connected === false) return true;
  if (isBrowserSaveDataEnabled()) return true;
  return !isWifiLikeConnection();
}

export function allowsHeavyNetworkUse(settings = getRuntimeSettings()) {
  if (isBrowserSaveDataEnabled()) return false;
  if (settings.wifi === false) return true;
  return !isMeteredConnection();
}

export function allowsSpeculativePrefetch(settings = getRuntimeSettings()) {
  return allowsHeavyNetworkUse(settings);
}

export function allowsHomeAutoUpdates(settings = getRuntimeSettings()) {
  if (settings.homeAutoUpdates === false) return false;
  return allowsHeavyNetworkUse(settings);
}

export function allowsVideoDataSaver(settings = getRuntimeSettings()) {
  return settings.videoDataSaver !== false;
}

export function getMeteredNetworkLimits(settings = getRuntimeSettings()) {
  const metered = !allowsHeavyNetworkUse(settings);
  return {
    metered,
    homeLatestLimit: metered ? 6 : 12,
    homeLatestConcurrency: metered ? 1 : 4,
    detailsCacheTtlMs: metered ? 5 * 60_000 : 3 * 60_000,
    htmlFetchConcurrency: metered ? 2 : 4,
    imageFetchConcurrency: metered ? 2 : 6,
  };
}

export function readerImageBudgetForFlag(metered) {
  if (metered) {
    return {
      initialWindow: 2,
      unlockBatch: 1,
      eagerPreloadPages: 0,
      highPriorityCount: 1,
      catalogPriorityCount: 1,
      catalogLazyCoverFrom: 2,
    };
  }
  return {
    initialWindow: 8,
    unlockBatch: 4,
    eagerPreloadPages: 8,
    highPriorityCount: 4,
    catalogPriorityCount: 4,
    catalogLazyCoverFrom: 6,
  };
}

export function getReaderImageBudget(settings = getRuntimeSettings()) {
  return readerImageBudgetForFlag(getMeteredNetworkLimits(settings).metered);
}
