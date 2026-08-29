import { Capacitor } from "@capacitor/core";
import { isChromebookApp, LOCALE_STORAGE_KEY } from "./config/appFlavor.js";
import { peekStorageString } from "./lib/storage/peek.js";
import { markNativeAppShell } from "./lib/platform/nativeAppLayout.js";

try {
  markNativeAppShell();
  if (isChromebookApp) {
    document.documentElement.classList.add("desktop-app");
    document.body?.classList.add("desktop-app");
  }
  if (peekStorageString(LOCALE_STORAGE_KEY) === "ar") {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.title = "CineVault";
  }
} catch (error) {
  // Ignore boot failures in restricted environments.
}
