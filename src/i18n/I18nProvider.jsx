import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, LOCALES, LOCALE_STORAGE_KEY, normalizeLocale } from "./locales";
import { getLocaleMeta, setRuntimeLocale, subscribeLocale, t as runtimeT } from "./runtime";

const I18nContext = createContext(null);

function readLocalLocale() {
  if (typeof localStorage === "undefined") return DEFAULT_LOCALE;
  try {
    return normalizeLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

function writeLocalLocale(locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore quota / private mode */
  }
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(readLocalLocale);

  useLayoutEffect(() => {
    setRuntimeLocale(locale);
    writeLocalLocale(locale);
  }, [locale]);

  useLayoutEffect(() => subscribeLocale((next) => {
    setLocaleState(normalizeLocale(next));
  }), []);

  const setLocale = useCallback((next) => {
    const normalized = normalizeLocale(next);
    writeLocalLocale(normalized);
    setLocaleState(normalized);
    setRuntimeLocale(normalized);
  }, []);

  const t = useCallback((key, vars) => runtimeT(key, vars), [locale]);

  const value = useMemo(() => ({
    locale,
    dir: getLocaleMeta(locale).dir,
    locales: LOCALES,
    setLocale,
    t,
  }), [locale, setLocale, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    return {
      locale: "ar",
      dir: "rtl",
      locales: LOCALES,
      setLocale: () => {},
      t: runtimeT,
    };
  }
  return value;
}
