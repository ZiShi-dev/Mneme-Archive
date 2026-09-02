import React from "react";
import { BookOpen, Clapperboard, Lock, Play } from "lucide-react";
import { t } from "../../i18n/runtime";
import { RemoteCover } from "./RemoteCover";
import { usesContainCover, usesWideCover, isStandaloneVideoCatalogItem } from "./coverDisplay";
import { getItemType, contentTypes } from "./contentTypes";
import { getMediaPresentation, isVideoMediaType } from "./mediaPresentation";
import { formatChapterPublishedLabel } from "../../lib/media/chapterTiming";
import { isCatalogChapterBlocked } from "../../lib/media/chapterLock";
import { UnlockCountdown } from "../../components/media/UnlockCountdown";

function audioBadgeKind(label = "") {
  const text = String(label).toUpperCase();
  if (/VOST/.test(text) && /VF/.test(text)) return "both";
  if (/VOST/.test(text)) return "vostfr";
  return "vf";
}

export function CoverAudioBadge({ label }) {
  if (!label) return null;
  return (
    <span className={`cover-audio-badge cover-audio-badge--${audioBadgeKind(label)}`}>{label}</span>
  );
}

function resolveCatalogChapters(item) {
  if (isStandaloneVideoCatalogItem(item)) return [];
  if (item.recentChapters?.length) {
    const openable = item.recentChapters
      .filter((chapter) => chapter?.url)
      .slice(0, 2);
    if (openable.length) return openable;
    return [];
  }
  if (item.latestChapter && item.latestChapter !== "—" && item.latestChapterUrl) {
    return [{ number: item.latestChapter, name: item.latestChapter, url: item.latestChapterUrl }];
  }
  return [];
}

function emptyChaptersMessage(item, profile, presentation) {
  const isNovel = item.mediaType === "novel"
    || (profile?.contentTypes?.length === 1 && profile.contentTypes[0] === "novel");
  if (isNovel) return t("sources.noChaptersNovel");
  if (presentation?.isVideo) return t("sources.noUnits", { units: presentation.units });
  if (item.mediaTypeLabel && !/رواية|مانغا|novel|manga/i.test(item.mediaTypeLabel)) {
    return t("sources.noChaptersFor", { label: item.mediaTypeLabel });
  }
  return t("sources.noChaptersManga");
}

export function CatalogCard({ item, profile, onOpenDetails, onOpenChapter, onPrefetchDetails }) {
  const recentChapters = resolveCatalogChapters(item);
  const mediaType = getItemType(item);
  const presentation = getMediaPresentation(mediaType);
  const isVideo = isVideoMediaType(mediaType);
  const UnitIcon = isVideo ? Clapperboard : BookOpen;
  const coverContain = usesContainCover(item.sourceId || profile?.id);
  const coverWide = isVideo || usesWideCover(item.sourceId || profile?.id, item.catalogStyle);
  const standaloneVideo = isStandaloneVideoCatalogItem(item);
  const postedLabel = formatChapterPublishedLabel(item.publishedAt);
  const prefetchDetails = onPrefetchDetails ? () => onPrefetchDetails(item) : undefined;

  const cardClass = [
    "live-manga-card",
    coverContain ? "live-manga-card--cover-contain" : "",
    coverWide ? "live-manga-card--cover-wide" : "",
    isVideo ? "live-manga-card--video" : "",
    standaloneVideo ? "live-manga-card--standalone-video" : "",
  ].filter(Boolean).join(" ");

  if (standaloneVideo && item.url) {
    return (
      <article className={cardClass}>
        <button
          type="button"
          className="live-manga-card__main live-manga-card__main--thumb"
          onClick={() => onOpenChapter(item, { url: item.url, name: item.title, number: "1" })}
          aria-label={`${presentation.watchLatest} — ${item.title}`}
        >
          <span className={`media-type-badge media-type-badge--${item.mediaType || "anime"}`}>
            {contentTypes[item.mediaType]?.singular || item.mediaTypeLabel || contentTypes.anime.singular}
          </span>
          <CoverAudioBadge label={item.audioLabel} />
          <span className="live-manga-card__cover">
            <RemoteCover src={item.cover} title={item.title} sourceId={item.sourceId || profile?.id} video={isVideo} contain={coverContain} />
            <span className="live-manga-card__play" aria-hidden="true">
              <Play size={22} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        </button>
        <div className="live-manga-card__youtube-meta">
          <button type="button" className="live-manga-card__title-btn" onPointerDown={prefetchDetails} onClick={() => onOpenDetails(item)}>
            <strong dir="auto">{item.title}</strong>
          </button>
          {postedLabel ? <small className="live-manga-card__posted">{postedLabel}</small> : null}
        </div>
      </article>
    );
  }

  return (
    <article className={cardClass}>
      <button className="live-manga-card__main" onPointerDown={prefetchDetails} onClick={() => onOpenDetails(item)} aria-label={t("sources.detailsOf", { title: item.title })}>
        <span className={`media-type-badge media-type-badge--${item.mediaType || "manga"}`}>{contentTypes[item.mediaType]?.singular || item.mediaTypeLabel || contentTypes.manga.singular}</span>
        <CoverAudioBadge label={item.audioLabel} />
        <span className="live-manga-card__cover">
          <RemoteCover src={item.cover} title={item.title} sourceId={item.sourceId || profile?.id} video={isVideo} contain={coverContain} />
        </span>
        <strong dir="auto">{item.title}</strong>
        {standaloneVideo && postedLabel ? <small className="live-manga-card__posted">{postedLabel}</small> : null}
      </button>
      {recentChapters.length ? (
        <div className="live-manga-card__chapters">
          {recentChapters.map((chapter, index) => {
            const blocked = isCatalogChapterBlocked(item.sourceId || profile?.id, chapter);
            const canOpen = Boolean(chapter.url) && !blocked;
            return (
              <button
                key={chapter.url || `${item.url}-${chapter.number || index}`}
                type="button"
                className={blocked ? "is-locked" : undefined}
                disabled={!canOpen}
                onClick={() => canOpen && onOpenChapter(item, chapter)}
                aria-label={blocked
                  ? t("sources.lockedChapterAria", { name: chapter.number || chapter.name })
                  : `${presentation.openAria(chapter.number || chapter.name)} — ${item.title}`}
              >
                <i>{index === 0 ? t("sources.latest") : t("sources.previous")}</i>
                <b>{presentation.rowPrefix} {chapter.number || chapter.name}</b>
                {blocked ? <Lock size={12} aria-hidden="true" /> : <UnitIcon size={12} />}
                {blocked ? <UnlockCountdown unlockAt={chapter.unlockAt} className="unlock-countdown--compact" /> : null}
              </button>
            );
          })}
        </div>
      ) : standaloneVideo && item.url ? (
        <div className="live-manga-card__chapters">
          <button
            type="button"
            onClick={() => onOpenChapter(item, { url: item.url, name: item.title, number: "1" })}
            aria-label={`${presentation.watchLatest} — ${item.title}`}
          >
            <i>{presentation.watchLatest}</i>
            <b>{postedLabel || presentation.watchLatest}</b>
            <UnitIcon size={12} />
          </button>
        </div>
      ) : item.chapterCount > 0 ? (
        <div className="live-manga-card__no-chapters" role="status" aria-label={t("sources.chapterCount", { count: item.chapterCount })}>
          <UnitIcon size={12} aria-hidden="true" />
          <span>{t("sources.chapterCount", { count: item.chapterCount })}</span>
        </div>
      ) : (
        <div className="live-manga-card__no-chapters" role="status" aria-label={emptyChaptersMessage(item, profile, presentation)}>
          <UnitIcon size={12} aria-hidden="true" />
          <span>{emptyChaptersMessage(item, profile, presentation)}</span>
        </div>
      )}
    </article>
  );
}

export function CatalogCardSkeleton({ mediaType = "manga" }) {
  const isVideo = mediaType === "anime" || mediaType === "movie" || mediaType === "series";
  const standaloneVideo = isVideo;
  return (
    <article className={`live-manga-card live-manga-card--skeleton live-manga-card--skeleton-${mediaType}${isVideo ? " live-manga-card--cover-wide live-manga-card--video" : ""}${standaloneVideo ? " live-manga-card--standalone-video" : ""}`} aria-hidden="true">
      <div className="live-manga-card__main live-manga-card__main--thumb">
        <span className="live-manga-card__cover-skeleton" />
      </div>
      {standaloneVideo ? (
        <div className="live-manga-card__youtube-meta">
          <span className="live-manga-card__title-skeleton" />
          <span className="live-manga-card__title-skeleton live-manga-card__title-skeleton--short" />
        </div>
      ) : (
        <>
          <div className="live-manga-card__main">
            <span className="live-manga-card__title-skeleton" />
            <span className="live-manga-card__title-skeleton live-manga-card__title-skeleton--short" />
          </div>
          <div className="live-manga-card__chapters">
            <span className="live-manga-card__chapter-skeleton" />
            <span className="live-manga-card__chapter-skeleton" />
          </div>
        </>
      )}
    </article>
  );
}

export function CatalogGridSkeleton({ mediaType = "manga", count = 9, label }) {
  return (
    <div className="live-manga-grid live-manga-grid--loading" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <CatalogCardSkeleton key={index} mediaType={mediaType} />
      ))}
    </div>
  );
}
