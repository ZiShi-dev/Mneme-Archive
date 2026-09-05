import { Capacitor } from "@capacitor/core";
import { lazy, Suspense } from "react";
import { isChromebookApp } from "./config/appFlavor";
import { isElectronApp } from "./lib/platform/electronApp";
import "./boot.js";
import { createRoot } from "react-dom/client";
import { markNativeAppShell } from "./lib/platform/nativeAppLayout";
import { initCapacitor } from "./capacitor";
import { StorageProvider } from "./components/storage/StorageProvider";
import { I18nProvider } from "./i18n/I18nProvider";
import { ToastProvider } from "./components/ui/ToastProvider";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { ThemedBootScreen } from "./components/boot/ThemedBootScreen";
import { initSentry } from "./lib/monitoring/sentry";
import { getAppBrandText } from "./lib/brand/appBrand";
import { t } from "./i18n/runtime";
import { readBootAppearance } from "./lib/theme/appearance";
import "./styles.css";

const App = lazy(() => import("./App").then((module) => ({ default: module.App })));
const OnboardingGate = lazy(() => import("./components/onboarding/OnboardingGate").then((module) => ({
  default: module.OnboardingGate,
})));

function showFatalBootError(error) {
  const root = document.getElementById("root");
  if (!root || root.dataset.booted === "1") return;
  const message = error instanceof Error ? error.message : String(error || "Erreur de démarrage");
  root.textContent = "";
  const box = document.createElement("div");
  box.setAttribute("role", "alert");
  box.style.cssText = "color:#f6f7f8;font:14px/1.45 system-ui,sans-serif;padding:24px;white-space:pre-wrap";
  box.textContent = message;
  root.appendChild(box);
}

function BootFallback() {
  return (
    <ThemedBootScreen
      appearance={readBootAppearance()}
      message={getAppBrandText(t).loading}
    />
  );
}

initSentry();
markNativeAppShell();

if (Capacitor.isNativePlatform() && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations?.()
    .then((registrations) => {
      for (const registration of registrations) void registration.unregister();
    })
    .catch(() => {
      // WebView sans service worker.
    });
}

if (isChromebookApp || isElectronApp()) {
  document.documentElement.classList.add("desktop-app");
  document.body?.classList.add("desktop-app");

  if (import.meta.env.PROD && !Capacitor.isNativePlatform()) {
    import("./pwaRegister.js").catch(() => {
      // PWA optionnelle hors navigateur / build Android.
    });
  }
}

if (Capacitor.isNativePlatform() && !isChromebookApp) {
  import("./lib/updates/backgroundFollowTask").catch(() => {
    // Plugin arrière-plan optionnel selon l'appareil.
  });
}

try {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Élément #root introuvable");
  createRoot(rootEl).render(
    <ErrorBoundary>
      <StorageProvider>
        <I18nProvider>
          <ToastProvider>
            <Suspense fallback={<BootFallback />}>
              <OnboardingGate>
                <App />
              </OnboardingGate>
            </Suspense>
          </ToastProvider>
        </I18nProvider>
      </StorageProvider>
    </ErrorBoundary>,
  );
  rootEl.dataset.booted = "1";
} catch (error) {
  showFatalBootError(error);
}
initCapacitor();
