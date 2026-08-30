import { isChromebookApp, LOCALE_STORAGE_KEY as FLAVOR_LOCALE_KEY } from "../config/appFlavor.js";

export const DEFAULT_LOCALE = "ar";
export const DEFAULT_UI_LOCALE = isChromebookApp ? "fr" : DEFAULT_LOCALE;
export const LOCALE_STORAGE_KEY = FLAVOR_LOCALE_KEY;

export const LOCALES = {
  ar: {
    id: "ar",
    dir: "rtl",
    htmlLang: "ar",
    nativeName: "العربية",
    latinName: "Arabe",
  },
  en: {
    id: "en",
    dir: "ltr",
    htmlLang: "en",
    nativeName: "English",
    latinName: "English",
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
