import { Capacitor } from "@capacitor/core";
import { isChromebookApp } from "./config/appFlavor";
import "./boot.js";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { initCapacitor } from "./capacitor";
import { StorageProvider } from "./components/storage/StorageProvider";
import { I18nProvider } from "./i18n/I18nProvider";
import { ToastProvider } from "./components/ui/ToastProvider";
import { App } from "./App";
import "./styles.css";

if (isChromebookApp) {
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
  <StorageProvider>
    <I18nProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </I18nProvider>
  </StorageProvider>,
);
initCapacitor();
