import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { initStorage, resetStorageInit } from "../../lib/storage/initStorage";
import { t } from "../../i18n/runtime";
import { AppMark } from "../brand/AppMark";
import { getAppBrandText } from "../../lib/brand/appBrand";

const StorageContext = createContext({ ready: false, error: null });

export function StorageProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [bootAttempt, setBootAttempt] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    SplashScreen.hide().catch(() => {});
  }, []);

  const retryBoot = useCallback(() => {
    resetStorageInit();
    setError(null);
    setReady(false);
    setBootAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    let active = true;
    initStorage()
      .then(() => {
        if (active) setReady(true);
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : t("app.storageError"));
          setReady(true);
        }
      });
    return () => { active = false; };
  }, [bootAttempt]);

  const value = useMemo(() => ({ ready, error }), [ready, error]);

  if (!ready) {
    return (
      <div className="boot-screen" role="status" aria-live="polite">
        <div className="boot-screen__inner">
          <AppMark size={64} variant="dark" className="boot-screen__mark" decorative />
          <p>{getAppBrandText(t).loading}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="boot-screen boot-screen--error" role="alert">
        <div className="boot-screen__inner">
          <p>{error}</p>
          <button type="button" className="boot-screen__retry" onClick={retryBoot}>
            {t("errors.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage() {
  return useContext(StorageContext);
}
