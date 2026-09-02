import React from "react";
import { BookOpen, Bookmark, ChevronLeft, Clapperboard } from "lucide-react";
import { Cover } from "../../components/manga/Cover";
import { RemoteCover, SourceLogo } from "../sources";
import { usesContainCover } from "../sources/coverDisplay";
import { useI18n } from "../../i18n/I18nProvider";
import { getBookmarkRowCopy } from "./favoritesModel";

export function BookmarkRow({
  entry,
  onOpen,
  onRemove,
  onContinue,
  onPrefetch,
  priority = false,
  coverSrc,
}) {
  const { t } = useI18n();
  const item = entry.item;
  const latestChapter = entry.kind === "live" ? item.recentChapters?.[0] : null;
  const subtitle = item.altTitle || item.subtitle;
  const progress = entry.kind === "demo" ? item.progress : null;
  const { typeLabel, readingLine, continueLabel, isVideo, isNovel } = getBookmarkRowCopy(entry, latestChapter, t);
  const ContinueIcon = isVideo ? Clapperboard : BookOpen;
  const prefetch = onPrefetch && entry.kind === "live" ? () => onPrefetch(item) : undefined;

  return (
    <article
      className={`bookmark-row bookmark-row--${entry.type}${latestChapter?.url ? " bookmark-row--continue" : ""}`}
    >
      <button
        className="bookmark-row__open"
        type="button"
        onPointerDown={prefetch}
        onClick={onOpen}
      >
        <span className={`bookmark-row__media bookmark-row__media--${entry.type}${isVideo ? " bookmark-row__media--video" : ""}`}>
          {entry.kind === "demo" ? (
            <Cover item={item} />
          ) : (
            <RemoteCover
              src={coverSrc || item.cover}
              title={item.title}
              sourceId={entry.sourceId || item.sourceId}
              video={isVideo}
              novel={isNovel}
              contain={usesContainCover(entry.sourceId || item.sourceId)}
              priority={priority}
            />
          )}
          <span className={`bookmark-row__type bookmark-row__type--${entry.type}`}>
            {typeLabel}
          </span>
        </span>
        <span className="bookmark-row__body">
          <strong dir="auto">{item.title}</strong>
          {subtitle && <span className="bookmark-row__subtitle" dir="auto">{subtitle}</span>}
          <span className="bookmark-row__source">
            <SourceLogo sourceId={entry.sourceId} />
            <span>{entry.sourceName}</span>
          </span>
          <span className="bookmark-row__reading">
            {entry.kind === "demo" ? (
              <>
                <em>{readingLine}</em>
                <b>{item.progress}%</b>
              </>
            ) : (
              <em>{readingLine}</em>
            )}
          </span>
          {progress != null && (
            <span className="bookmark-row__progress" aria-hidden="true">
              <span className="progress progress--thin">
                <span style={{ width: `${progress}%` }} />
              </span>
            </span>
          )}
        </span>
        <ChevronLeft className="bookmark-row__chevron" size={18} aria-hidden="true" />
      </button>
      <div className="bookmark-row__aside">
        <button
          className="bookmark-row__remove"
          type="button"
          onClick={onRemove}
          aria-label={`${t("favorites.remove")}: ${item.title}`}
          title={t("favorites.remove")}
        >
          <Bookmark size={15} fill="currentColor" aria-hidden="true" />
        </button>
        {continueLabel && (
          <button
            type="button"
            className="bookmark-row__continue"
            onPointerDown={prefetch}
            onClick={() => onContinue?.(item, latestChapter)}
          >
            <ContinueIcon size={13} aria-hidden="true" />
            <span>{continueLabel}</span>
          </button>
        )}
      </div>
    </article>
  );
}
