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
  if (!AUDIO_SOURCES.has(sourceId)) return [];
  const fromChapters = episodeLanguagesFromChapters(chapters);
  if (fromChapters.length > 1) return fromChapters;
  if (fromChapters.length === 1) return fromChapters;
  const fromLabel = parseAudioLabelOptions(item?.audioLabel);
  return fromLabel.length > 1 ? fromLabel : [];
}

export function pickDefaultAudioLanguage(available = [], preferred = "") {
  if (preferred && available.includes(preferred)) return preferred;
  if (available.includes("VF")) return "VF";
  return available[0] || "";
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
    return {
      ...chapter,
      preferredAudioLanguage: language,
    };
  }
  return chapter;
}
