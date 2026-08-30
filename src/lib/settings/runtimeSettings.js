import { configureFlareSolverr } from "../../../server/lib/flareSolverrConfig.js";
import { DEFAULT_APP_SETTINGS } from "./defaults.js";
import { getDefaultFlareSolverrUrl, normalizeFlareSolverrUrl, readFlareSolverrAuth } from "./flareSolverrUrl.js";
import { normalizeSettings } from "./normalizeSettings.js";

let currentSettings = { ...DEFAULT_APP_SETTINGS };

function syncFlareSolverrConfig(settings) {
  const baseUrl = normalizeFlareSolverrUrl(settings.flareSolverrUrl, {
    fallback: getDefaultFlareSolverrUrl(),
  });
  configureFlareSolverr(() => (baseUrl ? { baseUrl, ...readFlareSolverrAuth() } : null));
}

syncFlareSolverrConfig(currentSettings);

export function setRuntimeSettings(raw) {
  currentSettings = normalizeSettings(raw);
  syncFlareSolverrConfig(currentSettings);
}

export function getRuntimeSettings() {
  return currentSettings;
}
