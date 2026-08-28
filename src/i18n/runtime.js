import { applyDocumentLocale, DEFAULT_LOCALE, LOCALES, LOCALE_STORAGE_KEY, normalizeLocale } from "./locales.js";
import { translate } from "./translate.js";
import { ar } from "./ar.js";
import { fr } from "./fr.js";

const DICTIONARIES = { ar, fr };
const listeners = new Set();

let currentLocale = DEFAULT_LOCALE;

export function getLocale() {
  return currentLocale;
}

export function getLocaleMeta(localeId = currentLocale) {
  return LOCALES[normalizeLocale(localeId)];
}

export function t(key, vars) {
  return translate(DICTIONARIES[currentLocale], key, vars, DICTIONARIES[DEFAULT_LOCALE]);
}

function applyLocaleToDocument(locale) {
  applyDocumentLocale(locale);
  if (typeof document !== "undefined") {
    document.title = t("app.name");
  }
}

if (typeof localStorage !== "undefined") {
  try {
    currentLocale = normalizeLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
    applyLocaleToDocument(currentLocale);
  } catch {
    currentLocale = DEFAULT_LOCALE;
  }
}

export function setRuntimeLocale(nextLocale) {
  const locale = normalizeLocale(nextLocale);
  if (locale === currentLocale) {
    applyLocaleToDocument(locale);
    return locale;
  }
  currentLocale = locale;
  applyLocaleToDocument(locale);
  listeners.forEach((listener) => listener(locale));
  return locale;
}

export function subscribeLocale(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
