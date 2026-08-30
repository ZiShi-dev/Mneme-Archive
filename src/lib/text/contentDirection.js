const RTL_LANGUAGE_CODES = new Set(["ar", "fa", "he", "ur"]);
const RTL_TEXT_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
const LTR_TEXT_PATTERN = /[A-Za-z]/g;

export function isRtlLanguageCode(languageCode = "") {
  const normalized = String(languageCode || "").trim().toLowerCase().split("-")[0];
  return RTL_LANGUAGE_CODES.has(normalized);
}

export function detectTextDirection(samples = []) {
  const text = (Array.isArray(samples) ? samples : [])
    .slice(0, 16)
    .join(" ")
    .trim();
  if (!text) return "";

  const rtlCount = (text.match(RTL_TEXT_PATTERN) || []).length;
  const ltrCount = (text.match(LTR_TEXT_PATTERN) || []).length;
  if (rtlCount === 0 && ltrCount === 0) return "";
  if (rtlCount > ltrCount) return "rtl";
  if (ltrCount > rtlCount) return "ltr";
  return "";
}

export function resolveNovelContentDirection({
  contentLanguage = "",
  languages = [],
  paragraphs = [],
  fallback = "rtl",
} = {}) {
  const normalized = String(contentLanguage || "").trim().toLowerCase().split("-")[0];
  if (normalized) return isRtlLanguageCode(normalized) ? "rtl" : "ltr";

  const detected = detectTextDirection(paragraphs);
  if (detected) return detected;

  const profileLanguages = (Array.isArray(languages) ? languages : []).filter(Boolean);
  if (profileLanguages.length === 1) {
    return isRtlLanguageCode(profileLanguages[0]) ? "rtl" : "ltr";
  }

  return fallback === "ltr" ? "ltr" : "rtl";
}
