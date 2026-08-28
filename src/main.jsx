import { createRoot } from "react-dom/client";
import { initCapacitor } from "./capacitor";
import "./lib/updates/backgroundFollowTask";
import { StorageProvider } from "./components/storage/StorageProvider";
import { I18nProvider } from "./i18n/I18nProvider";
import { ToastProvider } from "./components/ui/ToastProvider";
import { App } from "./App";
import "./styles.css";

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
