import React from "react";
import { VideoPlaybackControls } from "../VideoPlaybackControls";
import { useI18n } from "../../../i18n/I18nProvider";

export function VideoEpisodeToolbar({
  visible = true,
  embedMode = false,
  unitLabel,
  controlsProps,
  ...chromeHandlers
}) {
  const { t, dir } = useI18n();
  const resolvedUnitLabel = unitLabel || t("media.theEpisode");

  if (!controlsProps) return null;

  return (
    <section
      className={`video-episode-toolbar${visible ? " is-visible" : ""}`}
      dir={dir}
      aria-hidden={visible ? undefined : "true"}
      aria-label={t("reader.playback.watchUnit", { unit: resolvedUnitLabel })}
      data-video-fixed-dock="true"
      {...chromeHandlers}
    >
      <div className="video-episode-toolbar__surface">
        <div className="video-episode-toolbar__inner">
          <VideoPlaybackControls
            {...controlsProps}
            dockOnly
            navOnly
            embedMode={embedMode}
            className="reader-playback--toolbar-nav"
          />
        </div>
      </div>
    </section>
  );
}
