import React from "react";
import { Bookmark, ChevronRight, ExternalLink } from "lucide-react";
import { burstSakuraFrom } from "../../../lib/sakura/burst";
import { useI18n } from "../../../i18n/I18nProvider";
import { ChapterLabel } from "./ChapterLabel";

export function ReaderEpisodeHeader({
  chapter,
  unitLabel,
  seriesTitle,
  chapterUrl,
  isFavorite = false,
  chromeHidden = false,
  onBack,
  onOpenDetails,
  onToggleFavorite,
}) {
  const { t, dir } = useI18n();

  return (
    <header
      className={`reader-episode-header${chromeHidden ? " reader-episode-header--hidden" : ""}`}
      dir={dir}
    >
      <button
        type="button"
        className="reader-episode-header__back"
        onClick={onBack}
        aria-label={t("reader.header.back")}
      >
        <ChevronRight size={17} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="reader-episode-header__identity"
        onClick={onOpenDetails}
        aria-label={t("reader.header.viewDetails", { title: seriesTitle })}
      >
        <ChapterLabel
          chapter={chapter}
          unitLabel={unitLabel}
          className="reader-episode-header__chapter"
          as="strong"
        />
        <span className="reader-episode-header__series" dir="auto">{seriesTitle}</span>
      </button>

      <div className="reader-episode-header__actions">
        <button
          type="button"
          className={`reader-episode-header__action${isFavorite ? " is-active" : ""}`}
          onClick={(event) => {
            if (!isFavorite) burstSakuraFrom(event.currentTarget);
            onToggleFavorite?.();
          }}
          aria-label={isFavorite ? t("reader.header.removeFavorite") : t("reader.header.addFavorite")}
          aria-pressed={isFavorite}
        >
          <Bookmark size={15} fill={isFavorite ? "currentColor" : "none"} />
        </button>
        {chapterUrl ? (
          <a
            className="reader-episode-header__action"
            href={chapterUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("reader.header.openInSource", { unit: t("media.theChapter") })}
          >
            <ExternalLink size={15} />
          </a>
        ) : null}
      </div>
    </header>
  );
}
