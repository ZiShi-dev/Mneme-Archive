import React, { useCallback, useEffect, useRef, useState } from "react";

const MIN_THUMB = 36;

export function ThemedScrollbar({ scrollerRef, className = "" }) {
  const railRef = useRef(null);
  const dragRef = useRef(null);
  const [metrics, setMetrics] = useState({
    thumbH: MIN_THUMB,
    thumbTop: 0,
    canScroll: false,
  });

  const update = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollHeight, clientHeight, scrollTop } = el;
    const canScroll = scrollHeight > clientHeight + 1;
    const trackH = railRef.current?.clientHeight || clientHeight;
    const thumbH = canScroll
      ? Math.max(MIN_THUMB, (clientHeight / scrollHeight) * trackH)
      : trackH;
    const maxTop = Math.max(0, trackH - thumbH);
    const progress = canScroll ? scrollTop / (scrollHeight - clientHeight) : 0;
    setMetrics({
      thumbH,
      thumbTop: progress * maxTop,
      canScroll,
    });
  }, [scrollerRef]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    update();
    const delayed = [100, 400, 900].map((ms) => window.setTimeout(update, ms));
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(() => {
      update();
      for (const child of el.children) ro.observe(child);
    });
    mo.observe(el, { childList: true, subtree: true });
    for (const child of el.children) ro.observe(child);
    window.addEventListener("resize", update);
    return () => {
      delayed.forEach((id) => window.clearTimeout(id));
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [scrollerRef, update]);

  function scrollFromClientY(clientY) {
    const el = scrollerRef.current;
    const rail = railRef.current;
    if (!el || !rail) return;
    const rect = rail.getBoundingClientRect();
    const trackH = rect.height;
    const thumbH = metrics.thumbH;
    const y = clientY - rect.top - thumbH / 2;
    const maxTop = Math.max(1, trackH - thumbH);
    const progress = Math.min(1, Math.max(0, y / maxTop));
    el.scrollTop = progress * (el.scrollHeight - el.clientHeight);
  }

  function onPointerDown(event) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = true;
    scrollFromClientY(event.clientY);
  }

  function onPointerMove(event) {
    if (!dragRef.current) return;
    scrollFromClientY(event.clientY);
  }

  function onPointerUp() {
    dragRef.current = false;
  }

  return (
    <div
      ref={railRef}
      className={`desktop-scroll${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <i
        className={`desktop-scroll__thumb${metrics.canScroll ? "" : " is-idle"}`}
        style={{ height: `${metrics.thumbH}px`, transform: `translateY(${metrics.thumbTop}px)` }}
      />
    </div>
  );
}
