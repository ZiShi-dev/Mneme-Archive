import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  addReaderScrollListener,
  getAppScrollElement,
} from "../../lib/platform/scrollRoot";

/** Place le pill dans le tiers supérieur de la zone de scroll visible. */
function computeToastTop(root) {
  if (!root || typeof root.getBoundingClientRect !== "function") {
    return Math.max(88, window.innerHeight * 0.22);
  }
  const rect = root.getBoundingClientRect();
  return rect.top + Math.max(72, Math.min(rect.height * 0.24, 148));
}

export function CatalogLoadingToast({ visible, label, hint = "" }) {
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (!visible) return undefined;
    const root = getAppScrollElement();
    const sync = () => setTop(computeToastTop(root));
    sync();
    const onResize = () => sync();
    window.addEventListener("resize", onResize);
    const detachScroll = addReaderScrollListener(sync);
    return () => {
      window.removeEventListener("resize", onResize);
      detachScroll();
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="catalog-loading-toast"
      style={{ top: `${top}px` }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <RefreshCw size={15} aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
    </div>
  );
}
