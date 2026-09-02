import { useEffect, useState } from "react";

/** Monte le contenu lourd après l’animation d’ouverture du sheet (évite le jank). */
export function useSheetContentReady(open, delayMs = 180) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return undefined;
    }

    let cancelled = false;
    const start = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window === "undefined") {
      start();
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      window.requestAnimationFrame(start);
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [open, delayMs]);

  return ready;
}
