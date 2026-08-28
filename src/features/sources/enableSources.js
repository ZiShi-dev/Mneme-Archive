import { t } from "../../i18n/runtime.js";
import {
  getSourceLanguageCodes,
  getSourceLanguageLabels,
  getSourceProfile,
} from "../../config/sources.js";

export const LANGUAGE_FILTER_ORDER = ["ar", "fr", "en", "ja", "ko", "zh"];

export function isSourceEnabled(source) {
  return source?.enabled !== false;
}

export function sourceMatchesQuery(profile, query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return true;
  return [profile.name, profile.arabicName, profile.domain, ...getSourceLanguageLabels(profile)]
    .some((value) => String(value).toLowerCase().includes(normalized));
}

export function sourceMatchesType(profile, type) {
  if (!type || type === "all") return true;
  return (profile.contentTypes || ["manga"]).includes(type);
}

export function sourceMatchesLanguage(profile, language) {
  if (!language || language === "all") return true;
  return getSourceLanguageCodes(profile).includes(language);
}

export function filterEnableSources(sources, { query = "", type = "all", language = "all", scope = "all" } = {}) {
  return (sources || []).filter((entry) => {
    const profile = getSourceProfile(entry.id);
    if (!sourceMatchesQuery(profile, query)) return false;
    if (!sourceMatchesType(profile, type)) return false;
    if (!sourceMatchesLanguage(profile, language)) return false;
    if (scope === "enabled") return isSourceEnabled(entry);
    if (scope === "disabled") return !isSourceEnabled(entry);
    return true;
  });
}

export function collectSourceLanguages(sources) {
  const present = new Set();
  for (const entry of sources || []) {
    for (const code of getSourceLanguageCodes(entry.id)) present.add(code);
  }
  const ordered = LANGUAGE_FILTER_ORDER.filter((code) => present.has(code));
  const extra = [...present].filter((code) => !LANGUAGE_FILTER_ORDER.includes(code));
  return [...ordered, ...extra];
}

export function languageFilterLabel(code) {
  return t(`language.${code}`) || code;
}

export function wouldLeaveNoEnabledSource(sources, id) {
  const target = (sources || []).find((entry) => entry.id === id);
  if (!target || !isSourceEnabled(target)) return false;
  return sources.filter(isSourceEnabled).length <= 1;
}
