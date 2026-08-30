import React from "react";
import { findActiveCue } from "./parseVtt";

export function VideoSubtitleOverlay({
  cues = [],
  currentTime = 0,
  enabled = true,
  loading = false,
  loadingLabel = "",
}) {
  const activeCue = enabled ? findActiveCue(cues, currentTime) : null;

  if (!enabled) return null;

  return (
    <div className="live-video-subtitle-overlay" aria-live="polite">
      {loading && !activeCue && loadingLabel ? (
        <p className="live-video-subtitle-overlay__loading">{loadingLabel}</p>
      ) : null}
      {activeCue ? (
        <p className="live-video-subtitle-overlay__line" dir="auto">{activeCue.text}</p>
      ) : null}
    </div>
  );
}
