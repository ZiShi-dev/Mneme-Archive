export const APP_FLAVOR = "chromebook";

export const isChromebookApp = APP_FLAVOR === "chromebook";

export const ALLOWED_SOURCE_IDS = isChromebookApp
  ? ["frenchstream", "wiflix", "coflix"]
  : null;

export const VISIBLE_MEDIA_TYPES = isChromebookApp
  ? ["movie", "series"]
  : ["manga", "novel", "anime", "movie", "series"];

export const NOTIFIABLE_MEDIA_TYPES = isChromebookApp
  ? ["series"]
  : null;

export function isNotifiableMediaType(mediaType) {
  if (!NOTIFIABLE_MEDIA_TYPES) return true;
  return NOTIFIABLE_MEDIA_TYPES.includes(mediaType);
}

export const PREFERRED_AUDIO_LANGUAGE = isChromebookApp ? "VOSTFR" : "VF";

export const DEFAULT_SOURCE_ID = isChromebookApp ? "frenchstream" : "mangalik";

export const LOCALE_STORAGE_KEY = isChromebookApp
  ? "cromebook:locale"
  : "living-archive:locale";

export function isAllowedSourceId(sourceId) {
  if (!ALLOWED_SOURCE_IDS) return true;
  return ALLOWED_SOURCE_IDS.includes(sourceId);
}
