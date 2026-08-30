const RTL_LANGUAGE_CODES = new Set(["ar", "fa", "he", "ur"]);

export function isRtlLanguageCode(languageCode = "") {
  const normalized = String(languageCode || "").trim().toLowerCase().split("-")[0];
  return RTL_LANGUAGE_CODES.has(normalized);
}

export function resolveNovelContentDirection({
  contentLanguage = "",
  languages = [],
  fallback = "rtl",
} = {}) {
  const normalized = String(contentLanguage || "").trim().toLowerCase().split("-")[0];
  if (normalized) return isRtlLanguageCode(normalized) ? "rtl" : "ltr";

  const profileLanguages = (Array.isArray(languages) ? languages : []).filter(Boolean);
  if (profileLanguages.length === 1) {
    return isRtlLanguageCode(profileLanguages[0]) ? "rtl" : "ltr";
  }

  return fallback === "ltr" ? "ltr" : "rtl";
}
