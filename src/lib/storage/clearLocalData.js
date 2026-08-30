import { CHAPTER_PROGRESS_PREFIX } from "./constants.js";
import { clearImageCache } from "./imageCache.js";
import { clearAllKvEntries, kvRemove, listKeysByPrefix } from "./kvStore.js";

const READING_STORAGE_KEYS = [
  "living-archive:reading-history",
  "living-archive:chapter-read-log",
  "mangashelf:reader-progress",
];

/** Efface la progression de lecture (historique, journal, % par chapitre). */
export async function clearReadingData() {
  await Promise.all(READING_STORAGE_KEYS.map((key) => kvRemove(key)));
  const progressKeys = listKeysByPrefix(CHAPTER_PROGRESS_PREFIX);
  await Promise.all(progressKeys.map((key) => kvRemove(key)));
}

/** Réinitialise toutes les données locales de l'application sur cet appareil. */
export async function clearAllLocalData() {
  await clearAllKvEntries();
  await clearImageCache();
  const { clearNativeHtmlCache } = await import("../platform/nativeHtmlCache.js");
  clearNativeHtmlCache();
  const { clearSourceApiCache } = await import("../../features/sources/sourceApi.js");
  clearSourceApiCache();
}
