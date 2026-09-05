import { Capacitor } from "@capacitor/core";
import { isChromebookApp } from "../../config/appFlavor.js";

export function isNativeMobileApp() {
  if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform()) {
    return !isChromebookApp;
  }
  return document.documentElement.classList.contains("native-app");
}

export function markNativeAppShell() {
  if (!Capacitor.isNativePlatform() || isChromebookApp) return;
  document.documentElement.classList.add("native-app");
  document.body?.classList.add("native-app");
  if (!document.documentElement.dataset.navMode) {
    document.documentElement.dataset.navMode = "buttons";
  }
}
