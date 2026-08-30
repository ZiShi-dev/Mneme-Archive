import React from "react";

export function ChapterListSkeleton({ count = 6, label }) {
  return (
    <div className="chapter-list live-chapter-list ui-skeleton-stack" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <div className="chapter-row-skeleton" key={index}>
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

export function ReaderPlaybackChapterSkeleton() {
  return (
    <span className="reader-playback__chapter-skeletons" aria-hidden="true">
      <span className="reader-playback__chapter-skeleton ui-skeleton" />
      <span className="reader-playback__chapter-skeleton reader-playback__chapter-skeleton--short ui-skeleton" />
    </span>
  );
}

export function DetailsDockSkeleton() {
  return (
    <div className="details-dock-skeleton" aria-hidden="true">
      <span className="details-dock-skeleton__cover ui-skeleton" />
      <div className="details-dock-skeleton__panel">
        <span className="details-dock-skeleton__button ui-skeleton" />
        <span className="details-dock-skeleton__chips ui-skeleton" />
      </div>
    </div>
  );
}

export function DetailsHeroHeadSkeleton() {
  return (
    <div className="details-hero-head-skeleton" aria-hidden="true">
      <span className="details-hero-head-skeleton__badge ui-skeleton" />
      <span className="details-hero-head-skeleton__title ui-skeleton" />
      <span className="details-hero-head-skeleton__line ui-skeleton" />
      <span className="details-hero-head-skeleton__line details-hero-head-skeleton__line--short ui-skeleton" />
    </div>
  );
}

export function DetailsContentSkeleton({
  label,
  cinematic = false,
  isMovie = false,
  showSidebar = true,
  chapterCount = 8,
  className = "",
}) {
  return (
    <div className={`details-content-skeleton${isMovie ? " details-content-skeleton--movie" : ""}${className ? ` ${className}` : ""}`.trim()}>
      {cinematic ? <DetailsDockSkeleton /> : null}
      <div className={`details-content-skeleton__grid${isMovie ? " details-content-skeleton__grid--movie" : ""}`}>
        {showSidebar ? (
          <div className="details-content-skeleton__sidebar" aria-hidden="true">
            <span className="details-content-skeleton__panel ui-skeleton" />
            <span className="details-content-skeleton__panel details-content-skeleton__panel--short ui-skeleton" />
          </div>
        ) : null}
        {chapterCount > 0 ? <ChapterListSkeleton count={chapterCount} label={label} /> : null}
      </div>
    </div>
  );
}

export function VideoStageSkeleton({ label }) {
  return (
    <div className="video-stage-skeleton" role="status" aria-live="polite" aria-label={label}>
      <span className="video-stage-skeleton__surface ui-skeleton" />
      <span className="video-stage-skeleton__bar ui-skeleton" />
      <span className="video-stage-skeleton__bar video-stage-skeleton__bar--short ui-skeleton" />
    </div>
  );
}

export function ReaderPagesSkeleton({ label, pages = 2 }) {
  return (
    <div className="reader-pages-skeleton" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: pages }, (_, index) => (
        <span key={index} className="reader-pages-skeleton__page ui-skeleton" />
      ))}
    </div>
  );
}

export function NovelReaderSkeleton({ label }) {
  return (
    <div className="novel-reader-skeleton" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className={`novel-reader-skeleton__line ui-skeleton${index % 3 === 2 ? " novel-reader-skeleton__line--short" : ""}`}
        />
      ))}
    </div>
  );
}
