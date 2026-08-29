import { useEffect, useRef } from "react";
import { getAppScrollElement } from "../lib/platform/scrollRoot";

const SCROLL_DELTA = 12;
const MIN_SCROLL_Y = 56;

function setBottomNavHidden(hidden) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("bottom-nav-hidden", hidden);
}

export function useHideBottomNavOnScroll(enabled) {
  const lastScrollTop = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setBottomNavHidden(false);
      return undefined;
    }

    const root = getAppScrollElement();
    if (!root) return undefined;

    lastScrollTop.current = root.scrollTop;
    setBottomNavHidden(false);

    const update = () => {
      ticking.current = false;
      const scrollTop = Math.max(0, root.scrollTop);
      const delta = scrollTop - lastScrollTop.current;

      if (scrollTop <= MIN_SCROLL_Y) {
        setBottomNavHidden(false);
      } else if (delta > SCROLL_DELTA) {
        setBottomNavHidden(true);
      } else if (delta < -SCROLL_DELTA) {
        setBottomNavHidden(false);
      }

      lastScrollTop.current = scrollTop;
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(update);
    };

    root.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      root.removeEventListener("scroll", onScroll);
      setBottomNavHidden(false);
    };
  }, [enabled]);
}
