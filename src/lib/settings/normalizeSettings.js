import { DEFAULT_APP_SETTINGS, PRELOAD_PAGES_MAX, PRELOAD_PAGES_MIN } from "./defaults.js";
import { normalizeCoflixBaseUrl } from "./coflixBaseUrl.js";
import { getDefaultFlareSolverrUrl, normalizeFlareSolverrUrl } from "./flareSolverrUrl.js";
import { getEffectiveSourceBaseUrl, normalizeSourceBaseUrlOverrides } from "./sourceBaseUrls.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeSettings(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_APP_SETTINGS };
  }

  const parsedPages = Number(raw.preloadPages);
  const parsedPoll = Number(raw.followPollMinutes);
  const parsedBackgroundInterval = Number(raw.backgroundIntervalMinutes);

  const sourceBaseUrls = normalizeSourceBaseUrlOverrides(raw.sourceBaseUrls, {
    legacyCoflixBaseUrl: raw.coflixBaseUrl,
  });

  return {
    ...DEFAULT_APP_SETTINGS,
    ...raw,
    notifications: raw.notifications !== false,
    preload: raw.preload !== false,
    wifi: raw.wifi !== false,
    homeAutoUpdates: raw.homeAutoUpdates !== false,
    videoDataSaver: raw.videoDataSaver !== false,
    backgroundSync: raw.backgroundSync !== false,
    preloadPages: clamp(
      Number.isFinite(parsedPages) ? parsedPages : DEFAULT_APP_SETTINGS.preloadPages,
      PRELOAD_PAGES_MIN,
      PRELOAD_PAGES_MAX,
    ),
    followPollMinutes: clamp(
      Number.isFinite(parsedPoll) ? parsedPoll : DEFAULT_APP_SETTINGS.followPollMinutes,
      1,
      60,
    ),
    backgroundIntervalMinutes: clamp(
      Number.isFinite(parsedBackgroundInterval) ? parsedBackgroundInterval : DEFAULT_APP_SETTINGS.backgroundIntervalMinutes,
      15,
      120,
    ),
    sourceBaseUrls,
    coflixBaseUrl: getEffectiveSourceBaseUrl("coflix", sourceBaseUrls) || normalizeCoflixBaseUrl(raw.coflixBaseUrl),
    flareSolverrUrl: normalizeFlareSolverrUrl(raw.flareSolverrUrl, {
      fallback: getDefaultFlareSolverrUrl(),
    }),
  };
}
