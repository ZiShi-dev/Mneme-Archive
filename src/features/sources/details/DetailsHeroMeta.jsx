import React from "react";
import { SourceLogo } from "../SourceLogo";

export function DetailsHeroMeta({
  isLoading,
  mediaType,
  typeLabel,
  publicationStatusKey,
  publicationStatusLabel,
  title,
  altTitle,
  showAltTitle,
  factChips,
  factLine,
  useFactChips,
  sourceId,
  sourceName,
}) {
  return (
    <div className="live-details-hero__meta">
      <div className="details-source-line">
        <span className={`media-type-badge media-type-badge--${mediaType}`}>{typeLabel}</span>
        {publicationStatusLabel ? (
          <span className={`publication-status publication-status--${publicationStatusKey || "unknown"}`}>
            {publicationStatusLabel}
          </span>
        ) : null}
      </div>
      <h1 className="live-details-hero__title" dir="auto">{title}</h1>
      {showAltTitle && altTitle ? <p className="live-details-hero__subtitle" dir="auto">{altTitle}</p> : null}
      {isLoading ? (
        <div className="details-hero-head-skeleton details-hero-head-skeleton--facts" aria-hidden="true">
          <span className="details-hero-head-skeleton__line ui-skeleton" />
          <span className="details-hero-head-skeleton__line details-hero-head-skeleton__line--short ui-skeleton" />
        </div>
      ) : (
        <>
          {useFactChips && factChips.length ? (
            <ul className="live-details-hero__facts live-details-hero__facts--chips">
              {factChips.map((fact) => <li key={fact}>{fact}</li>)}
            </ul>
          ) : null}
          {!useFactChips && factLine.length ? (
            <p className="live-details-hero__facts">{factLine.join(" · ")}</p>
          ) : null}
        </>
      )}
      <div className="live-details-hero__source">
        <SourceLogo sourceId={sourceId} />
        <span>{sourceName}</span>
      </div>
    </div>
  );
}
