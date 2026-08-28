import { useEffect, useRef } from "react";
import {
  computeReaderScrollProgress,
  shouldMarkChapterComplete,
} from "../lib/readingProgress";

export function useChapterCompletion({
  enabled,
  scrollProgress,
  progressKey,
  onComplete,
  rootSelector,
  readyDelayMs = 2000,
}) {
  const completedRef = useRef(false);
  const userScrolledRef = useRef(false);
  const readyAtRef = useRef(0);

  useEffect(() => {
    completedRef.current = false;
    userScrolledRef.current = false;
    readyAtRef.current = Date.now() + readyDelayMs;
  }, [progressKey, readyDelayMs]);

  useEffect(() => {
    if (!enabled) return undefined;
    const markUserScroll = () => {
      userScrolledRef.current = true;
    };
    window.addEventListener("scroll", markUserScroll, { passive: true });
    window.addEventListener("wheel", markUserScroll, { passive: true });
    window.addEventListener("touchmove", markUserScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", markUserScroll);
      window.removeEventListener("wheel", markUserScroll);
      window.removeEventListener("touchmove", markUserScroll);
    };
  }, [enabled, progressKey]);

  useEffect(() => {
    if (!enabled || !onComplete) return undefined;

    const markCompleted = () => {
      if (completedRef.current) return;
      if (Date.now() < readyAtRef.current) return;
      const currentProgress = computeReaderScrollProgress();
      if (!shouldMarkChapterComplete({
        userHasScrolled: userScrolledRef.current,
        scrollProgress: currentProgress,
      })) return;
      completedRef.current = true;
      onComplete(currentProgress);
    };

    const node = document.querySelector(rootSelector);
    if (!node) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.55)) {
        markCompleted();
      }
    }, { threshold: [0.55, 0.85] });
    observer.observe(node);

    const onScrollCheck = () => {
      if (completedRef.current) return;
      markCompleted();
    };
    window.addEventListener("scroll", onScrollCheck, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScrollCheck);
    };
  }, [enabled, onComplete, progressKey, rootSelector]);

  return { completedRef, userScrolledRef };
}
