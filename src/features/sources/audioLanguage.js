import { isChromebookApp, PREFERRED_AUDIO_LANGUAGE } from "../../config/appFlavor.js";
import { isVideoCatalogSource } from "./videoCatalog.js";

const AUDIO_SOURCES = new Set(["wiflix", "frenchstream"]);

export const AUDIO_LANGUAGE_LABELS = {
  VF: "VF",
  VOSTFR: "VOSTFR",
};

export function parseAudioLabelOptions(label = "") {
  const compact = String(label || "").toUpperCase().replace(/\s+/g, "");
  if (/VF\+VOSTFR|VOSTFR\+VF/.test(compact)) return ["VF", "VOSTFR"];
  if (compact.includes("VOSTFR")) return ["VOSTFR"];
  if (compact.includes("VF")) return ["VF"];
  return [];
}

export function episodeLanguagesFromChapters(chapters = []) {
  const languages = new Set();
  for (const chapter of chapters) {
    if (!chapter?.audioLanguages) continue;
    for (const key of Object.keys(chapter.audioLanguages)) {
      if (AUDIO_LANGUAGE_LABELS[key]) languages.add(key);
    }
  }
  const ordered = ["VF", "VOSTFR"].filter((entry) => languages.has(entry));
  return ordered.length ? ordered : [...languages];
}

export function resolveAvailableAudioLanguages(item, chapters = [], sourceId = "") {
  if (!isVideoCatalogSource(sourceId)) return [];
  const fromItem = Array.isArray(item?.availableAudioLanguages)
    ? item.availableAudioLanguages.filter((entry) => AUDIO_LANGUAGE_LABELS[entry])
    : [];
  const fromChapters = episodeLanguagesFromChapters(chapters);
  const fromLabel = parseAudioLabelOptions(item?.audioLabel);
  const merged = [...new Set([...fromItem, ...fromChapters, ...fromLabel])];
  return ["VF", "VOSTFR"].filter((entry) => merged.includes(entry));
}

export function pickDefaultAudioLanguage(available = [], preferred = "") {
  if (preferred && available.includes(preferred)) return preferred;
  if (available.includes(PREFERRED_AUDIO_LANGUAGE)) return PREFERRED_AUDIO_LANGUAGE;
  if (available.includes("VF")) return "VF";
  return available[0] || "";
}

export function itemOffersPreferredAudio(item, preferred = PREFERRED_AUDIO_LANGUAGE) {
  const options = parseAudioLabelOptions(item?.audioLabel);
  if (!options.length) return true;
  return options.includes(preferred);
}

export function sourceSupportsAudioFilter(sourceId = "") {
  return isVideoCatalogSource(sourceId);
}

export function resolveItemAudioOptions(item = {}) {
  const options = new Set([
    ...parseAudioLabelOptions(item?.audioLabel),
    ...(Array.isArray(item?.availableAudioLanguages)
      ? item.availableAudioLanguages.filter((entry) => AUDIO_LANGUAGE_LABELS[entry])
      : []),
  ]);
  return ["VF", "VOSTFR"].filter((entry) => options.has(entry));
}

export function itemMatchesAudioFilter(item, audioFilter = "all") {
  if (!audioFilter || audioFilter === "all") return true;
  const options = resolveItemAudioOptions(item);
  if (!options.length) return false;
  return options.includes(audioFilter);
}

export function filterItemsByAudioLanguage(items = [], audioFilter = "all") {
  if (!audioFilter || audioFilter === "all") return items;
  return items.filter((item) => itemMatchesAudioFilter(item, audioFilter));
}

/** @deprecated Use filterItemsByAudioLanguage with an explicit user choice instead. */
export function filterItemsByPreferredAudio(items = []) {
  if (!isChromebookApp) return items;
  return items.filter((item) => itemOffersPreferredAudio(item));
}

export function rewriteWiflixChapterLanguage(url = "", language = "VF") {
  const lang = language === "VOSTFR" ? "VOSTFR" : "VF";
  try {
    const target = new URL(String(url), "https://www.wiflix.tv");
    if (!target.searchParams.get("episode")) return url;
    target.searchParams.set("language", lang);
    return target.toString();
  } catch {
    return String(url || "").replace(/language=(VF|VOSTFR)/i, `language=${lang}`);
  }
}

export function applyAudioLanguageToChapter(chapter, language, sourceId) {
  if (!chapter || !language) return chapter;
  if (sourceId === "wiflix") {
    const nextUrl = chapter.audioLanguages?.[language]
      || rewriteWiflixChapterLanguage(chapter.url, language);
    return {
      ...chapter,
      url: nextUrl,
      preferredAudioLanguage: language,
    };
  }
  if (sourceId === "frenchstream") {
    const available = chapter.audioLanguages || {};
    const resolvedLanguage = available[language]
      ? language
      : pickDefaultAudioLanguage(Object.keys(available).filter((entry) => AUDIO_LANGUAGE_LABELS[entry]), language);
    return {
      ...chapter,
      preferredAudioLanguage: resolvedLanguage || language,
    };
  }
  return chapter;
}
