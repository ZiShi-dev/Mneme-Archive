import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

function closeTopLayer() {
  const selectors = [
    ".notify-sheet-backdrop:not([hidden])",
    ".genre-picker-backdrop",
    ".catalog-filter-picker-backdrop",
    ".catalog-source-picker-backdrop",
    ".confirm-dialog-backdrop",
  ];
  for (const selector of selectors) {
    const backdrop = document.querySelector(selector);
    const closeButton = backdrop?.querySelector(
      "button[data-sheet-close], button[aria-label*='close' i], button[aria-label*='fermer' i], .notify-sheet__done, .genre-picker header button",
    );
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.click();
      return true;
    }
  }
  return false;
}

export function useAndroidSystemNavigation({
  goBack,
  isOverlayOpen,
  canPopHistory,
}) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return undefined;
    }

    let listener;
    void App.addListener("backButton", () => {
      if (closeTopLayer()) return;
      if (isOverlayOpen) {
        goBack();
        return;
      }
      if (canPopHistory) {
        goBack();
        return;
      }
      void App.minimizeApp();
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      void listener?.remove();
    };
  }, [goBack, isOverlayOpen, canPopHistory]);
}
