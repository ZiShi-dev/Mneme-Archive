import { applyDocumentLocale, DEFAULT_LOCALE, DEFAULT_UI_LOCALE, LOCALES, LOCALE_STORAGE_KEY, normalizeLocale } from "./locales.js";
import { translate } from "./translate.js";
import { ar } from "./ar.js";
import { fr } from "./fr.js";
import { en } from "./en.js";
import { getAppDocumentTitle } from "../lib/brand/appBrand.js";
import { peekStorageString } from "../lib/storage/peek.js";

const DICTIONARIES = { ar, fr, en };
const LOCALE_FALLBACK = { ar: "ar", fr: "ar", en: "fr" };
const listeners = new Set();

let currentLocale = DEFAULT_LOCALE;

export function getLocale() {
  return currentLocale;
}

export function getLocaleMeta(localeId = currentLocale) {
  return LOCALES[normalizeLocale(localeId)];
}

export function t(key, vars) {
  const fallback = LOCALE_FALLBACK[currentLocale] || DEFAULT_LOCALE;
  return translate(DICTIONARIES[currentLocale], key, vars, DICTIONARIES[fallback]);
}

function applyLocaleToDocument(locale) {
  applyDocumentLocale(locale);
  if (typeof document !== "undefined") {
    document.title = getAppDocumentTitle(t);
  }
}

if (typeof localStorage !== "undefined") {
  try {
    const stored = peekStorageString(LOCALE_STORAGE_KEY);
    currentLocale = stored ? normalizeLocale(stored) : DEFAULT_UI_LOCALE;
    applyLocaleToDocument(currentLocale);
  } catch {
    currentLocale = DEFAULT_UI_LOCALE;
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
