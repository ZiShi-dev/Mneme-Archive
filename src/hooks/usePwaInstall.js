import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useState } from "react";
import { isChromebookApp } from "../config/appFlavor";
import { kvGetStringSync, kvSetString } from "../lib/storage/initStorage.js";

const PWA_DISMISS_KEY = "cinevault:pwa-install-dismissed";

const isNativeApp = () => Capacitor.isNativePlatform();

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isChromebookApp || isNativeApp() || typeof window === "undefined") return undefined;

    setDismissed(kvGetStringSync(PWA_DISMISS_KEY) === "1");

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    function onBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
    }

    function onAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") {
      setInstalled(true);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    kvSetString(PWA_DISMISS_KEY, "1");
  }, []);

  return {
    canInstall: !isNativeApp() && Boolean(deferredPrompt) && !installed,
    installed,
    dismissed,
    install,
    dismiss,
  };
}
