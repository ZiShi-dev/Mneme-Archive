import { Capacitor } from "@capacitor/core";
import { allowsVideoDataSaver, isMeteredConnection } from "../platform/dataSaver.js";
import { getRuntimeSettings } from "../settings/runtimeSettings.js";
import { isChromebookApp } from "../../config/appFlavor.js";

export function shouldLimitVideoQuality(settings = getRuntimeSettings()) {
  if (!allowsVideoDataSaver(settings)) return false;
  if (isChromebookApp) return false;
  return isMeteredConnection();
}

export function prefersHighVideoQuality(settings = getRuntimeSettings()) {
  return !shouldLimitVideoQuality(settings);
}

export function isNativeMobilePlayback() {
  return Capacitor.isNativePlatform() && !isChromebookApp;
}

export function createHlsPlayerConfig({ loader, nativeMobile = isNativeMobilePlayback() } = {}) {
  const settings = getRuntimeSettings();
  const limitQuality = shouldLimitVideoQuality(settings);
  const compactBuffer = limitQuality || nativeMobile;

  return {
    enableWorker: false,
    maxBufferLength: limitQuality ? 12 : compactBuffer ? 24 : 45,
    maxMaxBufferLength: limitQuality ? 24 : compactBuffer ? 48 : 90,
    maxLoadingRetry: limitQuality ? 4 : 8,
    maxNetworkErrorRetry: limitQuality ? 4 : 8,
    startLevel: limitQuality ? 0 : -1,
    capLevelToPlayerSize: limitQuality,
    abrEwmaDefaultEstimate: limitQuality ? 500_000 : 8_000_000,
    abrBandWidthFactor: limitQuality ? 0.8 : 0.95,
    abrBandWidthUpFactor: limitQuality ? 0.5 : 0.85,
    ...(loader ? { loader } : {}),
  };
}

export function getVideoPreloadMode() {
  const settings = getRuntimeSettings();
  if (shouldLimitVideoQuality(settings)) return "metadata";
  return "auto";
}
