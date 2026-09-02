import React, { useEffect, useState } from "react";
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
  className = "",
}) {
  const [failed, setFailed] = useState(false);
  const coverSrc = isPlaceholderCover(src) ? "" : normalizeRemoteImageUrl(src);
  const resolvedSrc = useResolvedCoverUrl(sourceId, coverSrc);
  const displaySrc = resolvedSrc || (!sourceId ? coverSrc : "");
  const loading = Boolean(coverSrc && !displaySrc && !failed);

  useEffect(() => {
    setFailed(false);
  }, [coverSrc, sourceId]);

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
      <div className={`${classes} remote-cover--fallback`}>
        <FallbackIcon size={hero || large ? 34 : 24} />
        <span>{title?.slice(0, 1) || "漫"}</span>
      </div>
    );
  }

  if (loading) {
    return <div className={classes} aria-hidden="true" />;
  }

  return (
    <img
      className={classes}
      src={displaySrc}
      alt={title}
      loading={priority ? "eager" : "lazy"}
      fetchpriority={priority ? "high" : "auto"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
