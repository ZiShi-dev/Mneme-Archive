import { isChromebookApp } from "../../config/appFlavor.js";
import { isElectronApp } from "./electronApp.js";

/** True when the UI should use the full application shell (sidebar, viewport plein écran). */
export function isDesktopAppLayout() {
  if (typeof document !== "undefined") {
    return document.documentElement.classList.contains("desktop-app");
  }
  return isChromebookApp || isElectronApp();
}
