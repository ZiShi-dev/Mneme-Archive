import { t } from "../../i18n/runtime.js";
import { isChromebookApp } from "../../config/appFlavor.js";
import { DEFAULT_APP_SETTINGS } from "./defaults.js";

export const DATA_USAGE_PRESETS = {
  saver: {
    id: "saver",
    get label() { return t("data.saver"); },
    get hint() { return t("data.saverHint"); },
    settings: {
      wifi: true,
      preload: false,
      preloadPages: 1,
      homeAutoUpdates: false,
      videoDataSaver: true,
      followPollMinutes: 10,
      backgroundSync: false,
      backgroundIntervalMinutes: 60,
    },
  },
  balanced: {
    id: "balanced",
    get label() { return t("data.balanced"); },
    get hint() { return t("data.balancedHint"); },
    settings: {
      ...DEFAULT_APP_SETTINGS,
    },
  },
  open: {
    id: "open",
    get label() { return t("data.open"); },
    get hint() { return t("data.openHint"); },
    settings: {
      wifi: false,
      preload: true,
      preloadPages: 3,
      homeAutoUpdates: true,
      videoDataSaver: false,
      followPollMinutes: 2,
      backgroundSync: true,
      backgroundIntervalMinutes: 15,
    },
  },
};

export function detectDataUsagePreset(settings) {
  const entries = Object.values(DATA_USAGE_PRESETS);
  const match = entries.find((preset) => Object.entries(preset.settings).every(
    ([key, value]) => settings[key] === value,
  ));
  return match?.id || "custom";
}

export function buildDataUsageSummary(settings) {
  const preset = detectDataUsagePreset(settings);
  if (preset !== "custom") {
    return `${t(`data.${preset}`)} · ${t(`data.${preset}Hint`)}`;
  }

  const parts = [];
  if (settings.wifi !== false) parts.push(t("data.wifiOnlyChip"));
  if (!isChromebookApp) {
    if (settings.preload === false) parts.push(t("data.noPreload"));
    else parts.push(t("data.pages", { n: settings.preloadPages }));
  }
  if (settings.homeAutoUpdates === false) parts.push(t("data.noAuto"));
  if (settings.videoDataSaver !== false) parts.push(t("data.videoSaverChip"));
  return parts.join(" · ") || t("data.custom");
}
