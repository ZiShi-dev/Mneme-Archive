import { Capacitor } from "@capacitor/core";
import { t } from "../../i18n/runtime.js";

export function getLiveSourcesWebMessage() {
  return t("app.liveSourcesWeb");
}

export function isLiveSourcesAvailable() {
  return Capacitor.isNativePlatform() || import.meta.env.DEV;
}

export function assertLiveSourcesAvailable() {
  if (!isLiveSourcesAvailable()) {
    throw new Error(getLiveSourcesWebMessage());
  }
}
