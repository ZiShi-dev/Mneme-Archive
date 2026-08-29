import { Capacitor } from "@capacitor/core";
import { ALLOWED_SOURCE_IDS, isChromebookApp } from "../../config/appFlavor.js";
import { t } from "../../i18n/runtime.js";

export function getLiveSourcesWebMessage() {
  return t("app.liveSourcesWeb");
}

export function isLiveSourcesAvailable() {
  if (Capacitor.isNativePlatform()) return true;
  if (import.meta.env?.DEV) return true;
  // Web builds with integrated source server (PWA CinéVault, Mneme Archive preview/prod).
  if (isChromebookApp || ALLOWED_SOURCE_IDS === null) return true;
  return false;
}

export function assertLiveSourcesAvailable() {
  if (!isLiveSourcesAvailable()) {
    throw new Error(getLiveSourcesWebMessage());
  }
}
