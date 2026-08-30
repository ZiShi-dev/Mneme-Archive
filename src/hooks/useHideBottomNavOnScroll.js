import { useEffect, useRef } from "react";
import {
  resolveBottomNavScrollHidden,
  shouldRevealBottomNavOnTap,
} from "../lib/platform/bottomNavChrome";
import { getAppScrollElement } from "../lib/platform/scrollRoot";

function setBottomNavHidden(hidden) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("bottom-nav-hidden", hidden);
}

export function useHideBottomNavOnScroll(enabled) {
  const lastScrollTop = useRef(0);
  const hiddenRef = useRef(false);
  const ticking = useRef(false);

  useEffect(() => {
    if (!enabled) {
      hiddenRef.current = false;
      setBottomNavHidden(false);
      return undefined;
    }

    const root = getAppScrollElement();
    if (!root) return undefined;

    lastScrollTop.current = root.scrollTop;
    hiddenRef.current = false;
    setBottomNavHidden(false);

    const applyHidden = (hidden) => {
      hiddenRef.current = hidden;
      setBottomNavHidden(hidden);
    };

    const update = () => {
      ticking.current = false;
      const next = resolveBottomNavScrollHidden({
        scrollTop: root.scrollTop,
        lastScrollTop: lastScrollTop.current,
        currentlyHidden: hiddenRef.current,
      });
      lastScrollTop.current = next.lastScrollTop;
      if (next.hidden !== hiddenRef.current) {
        applyHidden(next.hidden);
      }
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(update);
    };

    const revealOnTap = (event) => {
      if (!hiddenRef.current) return;
      if (!shouldRevealBottomNavOnTap(event.target)) return;
      applyHidden(false);
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("click", revealOnTap);
    root.addEventListener("touchend", revealOnTap, { passive: true });

    return () => {
      root.removeEventListener("scroll", onScroll);
      root.removeEventListener("click", revealOnTap);
      root.removeEventListener("touchend", revealOnTap);
      hiddenRef.current = false;
      setBottomNavHidden(false);
    };
  }, [enabled]);
}
