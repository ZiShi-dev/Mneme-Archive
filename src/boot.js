import { LOCALE_STORAGE_KEY } from "./config/appFlavor.js";
import { peekStorageString } from "./lib/storage/peek.js";

try {
  document.documentElement.classList.add("desktop-app");
  if (peekStorageString(LOCALE_STORAGE_KEY) === "ar") {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.title = "CineVault";
  }
} catch (error) {
  // Ignore boot failures in restricted environments.
}
