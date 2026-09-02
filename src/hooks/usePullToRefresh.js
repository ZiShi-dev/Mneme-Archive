import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_THRESHOLD = 68;
const DEFAULT_MAX_PULL = 108;
const PULL_RESISTANCE = 0.42;

export function computePullDistance(deltaY, maxPull = DEFAULT_MAX_PULL) {
  if (deltaY <= 0) return 0;
  return Math.min(deltaY * PULL_RESISTANCE, maxPull);
}

export function shouldTriggerRefresh(pullDistance, threshold = DEFAULT_THRESHOLD) {
  return pullDistance >= threshold;
}

export function usePullToRefresh({
  scrollerRef,
  onRefresh,
  enabled = true,
  threshold = DEFAULT_THRESHOLD,
  maxPull = DEFAULT_MAX_PULL,
}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const pullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);

  const resetPull = useCallback(() => {
    pullingRef.current = false;
    pullDistanceRef.current = 0;
    setPullDistance(0);
  }, []);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (!enabled) {
      resetPull();
      setRefreshing(false);
      return undefined;
    }

    const el = scrollerRef?.current;
    if (!el) return undefined;

    const onTouchStart = (event) => {
      if (refreshingRef.current || event.touches.length !== 1) return;
      if (el.scrollTop > 1) return;
      startYRef.current = event.touches[0].clientY;
      startXRef.current = event.touches[0].clientX;
      pullingRef.current = true;
    };

    const onTouchMove = (event) => {
      if (!pullingRef.current || refreshingRef.current) return;
      const touch = event.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = touch.clientX - startXRef.current;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        pullingRef.current = false;
        resetPull();
        return;
      }
      if (el.scrollTop > 1) {
        pullingRef.current = false;
        resetPull();
        return;
      }
      if (deltaY <= 0) {
        resetPull();
        return;
      }
      event.preventDefault();
      const next = computePullDistance(deltaY, maxPull);
      pullDistanceRef.current = next;
      setPullDistance(next);
    };

    const onTouchEnd = async () => {
      if (!pullingRef.current || refreshingRef.current) return;
      pullingRef.current = false;
      const distance = pullDistanceRef.current;
      if (!shouldTriggerRefresh(distance, threshold)) {
        resetPull();
        return;
      }
      setRefreshing(true);
      setPullDistance(threshold * 0.62);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
        resetPull();
      }
    };

    const onTouchCancel = () => {
      pullingRef.current = false;
      if (!refreshingRef.current) resetPull();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchCancel);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled, maxPull, onRefresh, resetPull, scrollerRef, threshold]);

  return { pullDistance, refreshing, threshold };
}
