import React from "react";
import { VideoEpisodeHeader } from "./VideoEpisodeHeader";
import { VideoEpisodeToolbar } from "./VideoEpisodeToolbar";

/**
 * Coque mobile du lecteur vidéo : header haut + scène + barre fixe bas.
 */
export function VideoWatchShell({
  headerProps,
  toolbarProps,
  stageClassName = "",
  children,
}) {
  return (
    <>
      {headerProps ? <VideoEpisodeHeader {...headerProps} /> : null}
      <div className={`video-watch-shell__stage${stageClassName ? ` ${stageClassName}` : ""}`}>
        {children}
      </div>
      {toolbarProps ? <VideoEpisodeToolbar {...toolbarProps} /> : null}
    </>
  );
}
