export const DEFAULT_LOCALE = "ar";
export const LOCALE_STORAGE_KEY = "living-archive:locale";

export const LOCALES = {
  ar: {
    id: "ar",
    dir: "rtl",
    htmlLang: "ar",
    nativeName: "العربية",
    latinName: "Arabe",
  },
  fr: {
    id: "fr",
    dir: "ltr",
    htmlLang: "fr",
    nativeName: "Français",
    latinName: "Français",
  },
};

export function normalizeLocale(value) {
  return LOCALES[value] ? value : DEFAULT_LOCALE;
}

export function applyDocumentLocale(localeId) {
  const locale = LOCALES[normalizeLocale(localeId)];
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale.htmlLang;
  document.documentElement.dir = locale.dir;
  document.body?.setAttribute("dir", locale.dir);
}
