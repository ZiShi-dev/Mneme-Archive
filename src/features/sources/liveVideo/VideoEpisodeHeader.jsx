import React from "react";
import { ChevronRight } from "lucide-react";
import { useI18n } from "../../../i18n/I18nProvider";

export function VideoEpisodeHeader({
  episodeLabel,
  seriesTitle,
  onBack,
  onOpenDetails,
  visible = true,
  ...chromeHandlers
}) {
  const { t, dir } = useI18n();

  return (
    <header
      className={`video-episode-header${visible ? " is-visible" : ""}`}
      dir={dir}
      aria-hidden={visible ? undefined : "true"}
      {...chromeHandlers}
    >
      <button
        type="button"
        className="video-episode-header__back"
        onClick={onBack}
        tabIndex={visible ? 0 : -1}
        aria-label={t("reader.header.back")}
      >
        <ChevronRight size={17} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="video-episode-header__identity"
        onClick={onOpenDetails}
        tabIndex={visible ? 0 : -1}
        aria-label={t("reader.header.viewDetails", { title: seriesTitle })}
      >
        <strong className="video-episode-header__episode" dir="auto">{episodeLabel}</strong>
        <span className="video-episode-header__series" dir="auto">{seriesTitle}</span>
      </button>
    </header>
  );
}
