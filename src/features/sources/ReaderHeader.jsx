import React from "react";
import { ArrowRight, Bookmark, ExternalLink, Settings2 } from "lucide-react";
import { RemoteCover } from "./RemoteCover";
import { burstSakuraFrom } from "../../lib/sakura/burst";
import { useI18n } from "../../i18n/I18nProvider";

export function ReaderHeader({
  title,
  cover,
  chapterName,
  sourceId,
  sourceName,
  progress = 0,
  chapterUrl,
  isFavorite = false,
  settingsOpen = false,
  unitLabel,
  hideSettings = false,
  variant = "default",
  chromeHidden = false,
  onBack,
  onOpenDetails,
  onOpenSettings,
  onToggleFavorite,
}) {
  const { t } = useI18n();
  const resolvedUnitLabel = unitLabel || t("media.theChapter");
  const isVideo = variant === "video";
  if (isVideo) {
    return (
      <header className="reader-header reader-header--video">
        <button type="button" className="reader-header__back reader-header__back--video" onClick={onBack} aria-label={t("reader.header.back")}>
          <ArrowRight size={16} className="reader-header__back-icon" aria-hidden="true" />
        </button>

        <div className="reader-header__identity reader-header__identity--video">
          <button
            type="button"
            className="reader-header__cover reader-header__cover--video"
            onClick={onOpenDetails}
            aria-label={t("reader.header.viewDetails", { title })}
          >
            <RemoteCover
              src={cover}
              title={title}
              sourceId={sourceId}
              className="reader-header__cover-image"
              video
              priority
            />
          </button>
          <button type="button" className="reader-header__copy reader-header__copy--video" onClick={onOpenDetails}>
            <span className="reader-header__episode-row">
              <strong className="reader-header__episode" dir="auto">{chapterName}</strong>
              <b className="reader-header__progress">{Math.round(progress)}%</b>
            </span>
            <span className="reader-header__series" dir="auto">{title}</span>
            <span className="reader-header__meta reader-header__meta--video">
              <em>{sourceName}</em>
            </span>
          </button>
        </div>

        <nav className="reader-header__toolbar" aria-label={t("reader.header.viewingTools")}>
          <div className="reader-header__toolbar-utils reader-header__toolbar-utils--solo">
            <button
              type="button"
              className={`reader-header__action reader-header__action--video${isFavorite ? " active" : ""}`}
              onClick={(event) => {
                if (!isFavorite) burstSakuraFrom(event.currentTarget);
                onToggleFavorite();
              }}
              aria-label={isFavorite ? t("reader.header.removeFavorite") : t("reader.header.addFavorite")}
              aria-pressed={isFavorite}
            >
              <Bookmark size={15} strokeWidth={2.1} fill={isFavorite ? "currentColor" : "none"} />
            </button>
            <a
              className="reader-header__action reader-header__action--video"
              href={chapterUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("reader.header.openInSource", { unit: resolvedUnitLabel })}
            >
              <ExternalLink size={15} strokeWidth={2.1} />
            </a>
          </div>
        </nav>
      </header>
    );
  }

  return (
    <header className={`reader-header${chromeHidden ? " reader-header--chrome-hidden" : ""}`}>
      <div className="reader-header__lead">
        <button type="button" className="reader-header__back" onClick={onBack} aria-label={t("reader.header.back")}>
          <ArrowRight size={20} />
        </button>

        <div className="reader-header__main">
          <div className="reader-header__identity">
            <button
              type="button"
              className="reader-header__cover"
              onClick={onOpenDetails}
              aria-label={t("reader.header.viewDetails", { title })}
            >
              <RemoteCover
                src={cover}
                title={title}
                sourceId={sourceId}
                className="reader-header__cover-image"
                priority
              />
            </button>
            <button type="button" className="reader-header__copy" onClick={onOpenDetails}>
              <strong className="reader-header__title" dir="auto">{title}</strong>
              <span className="reader-header__meta">
                <em>{resolvedUnitLabel} {chapterName}</em>
                <i>{sourceName}</i>
                <b>{Math.round(progress)}%</b>
              </span>
            </button>
          </div>
        </div>
      </div>

      <nav className="reader-header__actions" aria-label={hideSettings ? t("reader.header.viewingTools") : t("reader.header.readingTools")}>
        {!hideSettings && (
          <button
            type="button"
            className="reader-header__action"
            onClick={onOpenSettings}
            aria-label={t("reader.header.displaySettings")}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
          >
            <Settings2 size={17} />
          </button>
        )}
        <button
          type="button"
          className={`reader-header__action${isFavorite ? " active" : ""}`}
          onClick={(event) => {
            if (!isFavorite) burstSakuraFrom(event.currentTarget);
            onToggleFavorite();
          }}
          aria-label={isFavorite ? t("reader.header.removeFavorite") : t("reader.header.addFavorite")}
          aria-pressed={isFavorite}
        >
          <Bookmark size={17} fill={isFavorite ? "currentColor" : "none"} />
        </button>
        <a
          className="reader-header__action"
          href={chapterUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("reader.header.openInSource", { unit: resolvedUnitLabel })}
        >
          <ExternalLink size={17} />
        </a>
      </nav>
    </header>
  );
}
