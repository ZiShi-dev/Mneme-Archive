import React, { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
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
  const resolvedSrc = useResolvedCoverUrl(sourceId, src);
  const loading = Boolean(sourceId && src && !resolvedSrc && !failed);

  useEffect(() => setFailed(false), [resolvedSrc]);

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

  if (!src || failed) {
    return (
      <div className={`${classes} remote-cover--fallback`}>
        <BookOpen size={hero || large ? 34 : 24} />
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
      src={resolvedSrc || src}
      alt={title}
      loading={priority ? "eager" : "lazy"}
      fetchpriority={priority ? "high" : "auto"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
