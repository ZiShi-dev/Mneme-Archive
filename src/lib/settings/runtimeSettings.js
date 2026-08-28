import { DEFAULT_APP_SETTINGS } from "./defaults.js";
import { normalizeSettings } from "./normalizeSettings.js";

let currentSettings = { ...DEFAULT_APP_SETTINGS };

export function setRuntimeSettings(raw) {
  currentSettings = normalizeSettings(raw);
}

export function getRuntimeSettings() {
  return currentSettings;
}
