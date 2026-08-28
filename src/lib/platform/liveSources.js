import { Capacitor } from "@capacitor/core";
import { isChromebookApp } from "../../config/appFlavor.js";
import { t } from "../../i18n/runtime.js";

export function getLiveSourcesWebMessage() {
  return t("app.liveSourcesWeb");
}

export function isLiveSourcesAvailable() {
  if (Capacitor.isNativePlatform()) return true;
  if (import.meta.env?.DEV) return true;
  // CinéVault web (PWA, preview, start:prod) — pas seulement le mode dev Vite.
  if (isChromebookApp) return true;
  return false;
}

export function assertLiveSourcesAvailable() {
  if (!isLiveSourcesAvailable()) {
    throw new Error(getLiveSourcesWebMessage());
  }
}
