import { Capacitor } from "@capacitor/core";
import { isChromebookApp } from "./config/appFlavor";
import { isElectronApp } from "./lib/platform/electronApp";
import "./boot.js";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { initCapacitor } from "./capacitor";
import { StorageProvider } from "./components/storage/StorageProvider";
import { I18nProvider } from "./i18n/I18nProvider";
import { ToastProvider } from "./components/ui/ToastProvider";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { App } from "./App";
import { initSentry } from "./lib/monitoring/sentry";
import "./styles.css";

initSentry();

if (isChromebookApp || isElectronApp()) {
  document.documentElement.classList.add("desktop-app");
  document.body.classList.add("desktop-app");

  if (import.meta.env.PROD && !Capacitor.isNativePlatform()) {
    registerSW({ immediate: true });
  }
}

if (Capacitor.isNativePlatform() && !isChromebookApp) {
  import("./lib/updates/backgroundFollowTask").catch(() => {
    // Plugin arrière-plan optionnel selon l'appareil.
  });
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <StorageProvider>
      <I18nProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </I18nProvider>
    </StorageProvider>
  </ErrorBoundary>,
);
initCapacitor();
