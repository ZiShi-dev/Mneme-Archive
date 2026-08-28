import React from "react";
import { BookOpen, Clapperboard } from "lucide-react";
import { t } from "../../i18n/runtime";
import { RemoteCover } from "./RemoteCover";
import { getItemType, contentTypes } from "./contentTypes";
import { getMediaPresentation, isVideoMediaType } from "./mediaPresentation";

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

export function CatalogCard({ item, profile, onOpenDetails, onOpenChapter }) {
  const recentChapters = resolveCatalogChapters(item);
  const mediaType = getItemType(item);
  const presentation = getMediaPresentation(mediaType);
  const isVideo = isVideoMediaType(mediaType);
  const UnitIcon = isVideo ? Clapperboard : BookOpen;

  return (
    <article className="live-manga-card">
      <button className="live-manga-card__main" onClick={() => onOpenDetails(item)} aria-label={t("sources.detailsOf", { title: item.title })}>
        <span className={`media-type-badge media-type-badge--${item.mediaType || "manga"}`}>{contentTypes[item.mediaType]?.singular || item.mediaTypeLabel || contentTypes.manga.singular}</span>
        <CoverAudioBadge label={item.audioLabel} />
        <RemoteCover src={item.cover} title={item.title} sourceId={item.sourceId || profile?.id} video={isVideo} />
        <strong dir="auto">{item.title}</strong>
      </button>
      {recentChapters.length ? (
        <div className="live-manga-card__chapters">
          {recentChapters.map((chapter, index) => {
            const canOpen = Boolean(chapter.url);
            return (
              <button
                key={chapter.url || `${item.url}-${chapter.number || index}`}
                disabled={!canOpen}
                onClick={() => canOpen && onOpenChapter(item, chapter)}
                aria-label={`${presentation.openAria(chapter.number || chapter.name)} — ${item.title}`}
              >
                <i>{index === 0 ? t("sources.latest") : t("sources.previous")}</i>
                <b>{presentation.rowPrefix} {chapter.number || chapter.name}</b>
                <UnitIcon size={12} />
              </button>
            );
          })}
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
  return (
    <article className={`live-manga-card live-manga-card--skeleton live-manga-card--skeleton-${mediaType}`} aria-hidden="true">
      <div className="live-manga-card__main">
        <span className="live-manga-card__cover-skeleton" />
        <span className="live-manga-card__title-skeleton" />
        <span className="live-manga-card__title-skeleton live-manga-card__title-skeleton--short" />
      </div>
      <div className="live-manga-card__chapters">
        <span className="live-manga-card__chapter-skeleton" />
        <span className="live-manga-card__chapter-skeleton" />
      </div>
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
