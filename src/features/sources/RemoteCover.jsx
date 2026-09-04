import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Clapperboard, Sparkles } from "lucide-react";
import { isPlaceholderCover, normalizeRemoteImageUrl } from "./coverDisplay";
import { useResolvedCoverUrl } from "./useResolvedCoverUrl";

export function RemoteCover({
  src,
  title,
  large = false,
  hero = false,
  novel = false,
  video = false,
  contain = false,
  sourceId,
  priority = false,
  lazy = false,
  className = "",
}) {
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(!lazy || priority);
  const rootRef = useRef(null);
  const coverSrc = isPlaceholderCover(src) ? "" : normalizeRemoteImageUrl(src);
  const resolvedSrc = useResolvedCoverUrl(sourceId, coverSrc, { enabled: visible || priority });
  const displaySrc = resolvedSrc || (!sourceId ? coverSrc : "");
  const loading = Boolean(coverSrc && !displaySrc && !failed);

  useEffect(() => {
    setFailed(false);
  }, [coverSrc, sourceId]);

  useEffect(() => {
    if (!lazy || priority || visible) return undefined;
    const node = rootRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "280px 0px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [lazy, priority, visible]);

  const classes = [
    "remote-cover",
    large ? "remote-cover--large" : "",
    hero ? "remote-cover--hero" : "",
    novel ? "remote-cover--novel" : "",
    video ? "remote-cover--video" : "",
    contain ? "remote-cover--contain" : "",
    loading ? "remote-cover--loading" : "",
    className,
  ].filter(Boolean).join(" ");

  if (!coverSrc || failed) {
    const FallbackIcon = video ? Clapperboard : novel ? Sparkles : BookOpen;
    return (
      <div ref={rootRef} className={`${classes} remote-cover--fallback`}>
        <FallbackIcon size={hero || large ? 34 : 24} />
        <span>{title?.slice(0, 1) || "漫"}</span>
      </div>
    );
  }

  if (loading) {
    return <div ref={rootRef} className={classes} aria-hidden="true" />;
  }

  return (
    <img
      ref={rootRef}
      className={classes}
      src={displaySrc}
      alt={title}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
