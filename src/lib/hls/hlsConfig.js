import { allowsVideoDataSaver, isMeteredConnection } from "../platform/dataSaver.js";
import { getRuntimeSettings } from "../settings/runtimeSettings.js";

export function createHlsPlayerConfig({ loader } = {}) {
  const settings = getRuntimeSettings();
  const metered = isMeteredConnection() && allowsVideoDataSaver(settings);

  return {
    enableWorker: false,
    maxBufferLength: metered ? 12 : 30,
    maxMaxBufferLength: metered ? 24 : 60,
    maxLoadingRetry: metered ? 4 : 8,
    maxNetworkErrorRetry: metered ? 4 : 8,
    startLevel: metered ? 0 : -1,
    capLevelToPlayerSize: true,
    ...(loader ? { loader } : {}),
  };
}

export function getVideoPreloadMode() {
  const settings = getRuntimeSettings();
  if (isMeteredConnection() && allowsVideoDataSaver(settings)) return "metadata";
  return "auto";
}
