import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { initStorage, resetStorageInit } from "../../lib/storage/initStorage";
import { t } from "../../i18n/runtime";
import { getAppBrandText } from "../../lib/brand/appBrand";
import { applyAppearance, readBootAppearance } from "../../lib/theme/appearance";
import { syncNativeChrome } from "../../lib/theme/nativeChrome";
import { ThemedBootScreen } from "../boot/ThemedBootScreen";

const StorageContext = createContext({ ready: false, error: null });

async function hideNativeSplash() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SplashScreen.hide();
  } catch {
    // Plugin optionnel.
  }
}

export function StorageProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [bootAppearance, setBootAppearance] = useState(() => readBootAppearance());

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
        if (!active) return;
        const appearance = readBootAppearance();
        applyAppearance(appearance);
        void syncNativeChrome(appearance);
        setBootAppearance(appearance);
        setReady(true);
        void hideNativeSplash();
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : t("app.storageError"));
          setReady(true);
          void hideNativeSplash();
        }
      });
    return () => { active = false; };
  }, [bootAttempt]);

  const value = useMemo(() => ({ ready, error }), [ready, error]);

  if (!ready) {
    return (
      <ThemedBootScreen
        appearance={bootAppearance}
        message={getAppBrandText(t).loading}
      />
    );
  }

  if (error) {
    return (
      <ThemedBootScreen
        appearance={bootAppearance}
        message={error}
        retryLabel={t("errors.retry")}
        error
        onRetry={retryBoot}
      />
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
