import React from "react";
import { ReaderPlaybackControls } from "../ReaderPlaybackControls";
import { useI18n } from "../../../i18n/I18nProvider";

export function ReaderEpisodeToolbar({ visible = true, controlsProps }) {
  const { t, dir } = useI18n();

  if (!visible || !controlsProps) return null;

  return (
    <section
      className="reader-episode-toolbar"
      dir={dir}
      aria-label={t("reader.playback.chapterFollow")}
      data-reader-fixed-dock="true"
    >
      <div className="reader-episode-toolbar__surface">
        <div className="reader-episode-toolbar__inner">
          <ReaderPlaybackControls {...controlsProps} dockOnly />
        </div>
      </div>
    </section>
  );
}
