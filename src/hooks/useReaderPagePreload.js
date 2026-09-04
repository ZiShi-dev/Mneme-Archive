import { useEffect, useRef } from "react";
import { PRELOAD_PAGES_MAX, PRELOAD_PAGES_MIN } from "../lib/settings/defaults";
import { getReaderImageBudget } from "../lib/platform/dataSaver";
import { refreshNetworkStatus } from "../lib/platform/networkStatus";
import {
  canPreloadPages,
  preloadPagesAhead,
  resetPagePreloadCache,
} from "../lib/reading/pagePreload";

function clampPreloadCount(value) {
  return Math.max(PRELOAD_PAGES_MIN, Math.min(PRELOAD_PAGES_MAX, Number(value) || 3));
}

export function useReaderPagePreload({
  enabled,
  wifiOnly,
  preloadCount,
  sourceId,
  pages,
  chapterUrl,
  containerRef,
}) {
  const maxVisibleIndex = useRef(-1);

  useEffect(() => {
    resetPagePreloadCache();
    maxVisibleIndex.current = -1;
  }, [sourceId, chapterUrl]);

  useEffect(() => {
    if (!enabled || !pages?.length || !sourceId) return undefined;

    const abortController = new AbortController();
    const count = clampPreloadCount(preloadCount);
    const options = { preload: enabled, wifiOnly };

    const runPreload = (fromIndex) => {
      if (!canPreloadPages(options) || abortController.signal.aborted) return;
      preloadPagesAhead({
        sourceId,
        pages,
        visibleIndex: fromIndex,
        count,
        signal: abortController.signal,
      });
    };

    const { eagerPreloadPages } = getReaderImageBudget();
    if (canPreloadPages(options) && eagerPreloadPages > 0) {
      preloadPagesAhead({
        sourceId,
        pages,
        visibleIndex: -1,
        count: Math.max(count, eagerPreloadPages),
        signal: abortController.signal,
      });
    }

    const container = containerRef?.current;
    if (!container) {
      return () => abortController.abort();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number(entry.target.dataset.pageIndex);
          if (!Number.isFinite(index)) return;
          if (index <= maxVisibleIndex.current) return;
          maxVisibleIndex.current = index;
          runPreload(index);
        });
      },
      { root: null, rootMargin: "240px 0px", threshold: 0.01 },
    );

    container.querySelectorAll("[data-page-index]").forEach((element) => {
      observer.observe(element);
    });

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const handleConnectionChange = () => {
      void refreshNetworkStatus().then(() => runPreload(maxVisibleIndex.current));
    };
    connection?.addEventListener?.("change", handleConnectionChange);

    return () => {
      abortController.abort();
      observer.disconnect();
      connection?.removeEventListener?.("change", handleConnectionChange);
    };
  }, [enabled, wifiOnly, preloadCount, sourceId, pages, chapterUrl, containerRef]);
}
