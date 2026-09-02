import { useEffect } from "react";
import { APP_PULL_REFRESH } from "../lib/platform/appRefresh";

/** Enregistre un rafraîchissement pour l'écran actif (pull-to-refresh). */
export function useAppPullRefreshHandler(handler, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof handler !== "function") return undefined;

    const onRefresh = (event) => {
      const detail = event.detail || {};
      if (!Array.isArray(detail.tasks)) detail.tasks = [];
      detail.handled = true;

      try {
        const result = handler(event);
        if (result && typeof result.then === "function") {
          detail.tasks.push(result);
        }
      } catch (error) {
        detail.tasks.push(Promise.reject(error));
      }
    };

    document.addEventListener(APP_PULL_REFRESH, onRefresh);
    return () => document.removeEventListener(APP_PULL_REFRESH, onRefresh);
  }, [enabled, handler]);
}
