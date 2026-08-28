import { getNetworkStatus, isWifiLikeConnection } from "./networkStatus.js";
import { getRuntimeSettings } from "../settings/runtimeSettings.js";

export function isMeteredConnection() {
  const { connected } = getNetworkStatus();
  if (connected === false) return true;
  return !isWifiLikeConnection();
}

export function allowsHeavyNetworkUse(settings = getRuntimeSettings()) {
  if (settings.wifi === false) return true;
  return !isMeteredConnection();
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
    homeLatestConcurrency: metered ? 1 : 3,
    detailsCacheTtlMs: metered ? 5 * 60_000 : 3 * 60_000,
  };
}
