import React from "react";
import { DetailsDockSkeleton } from "../../../components/ui/ContentSkeleton";
import { DETAILS_HERO_LAYOUT } from "./detailsLayout";

export function DetailsCinematicHero({
  heroLayout,
  status,
  heroCover,
  heroMeta,
  heroActions,
  standaloneVideo = false,
}) {
  const isLoading = status === "loading";
  const isReadingLayout = heroLayout === DETAILS_HERO_LAYOUT.READING;

  if (standaloneVideo) {
    return (
      <>
        <div className="live-details-hero__content live-details-hero__content--standalone-video">
          {isLoading ? <DetailsDockSkeleton /> : heroCover}
          {!isLoading ? heroMeta : null}
        </div>
        {!isLoading && heroActions ? (
          <div className="live-details-hero__actions live-details-hero__actions--standalone-video">
            {heroActions}
          </div>
        ) : null}
      </>
    );
  }

  if (isReadingLayout) {
    return (
      <>
        <div className="live-details-hero__content live-details-hero__content--reading">
          {heroCover}
          <div className="live-details-hero__reading-panel">
            {heroMeta}
          </div>
        </div>
        {!isLoading && heroActions ? (
          <div className="live-details-hero__actions">
            {heroActions}
          </div>
        ) : isLoading ? (
          <div className="live-details-hero__actions live-details-hero__actions--loading" aria-hidden="true">
            <span className="details-dock-skeleton__button ui-skeleton" />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="live-details-hero__head">
        {heroMeta}
      </div>
      <div className="live-details-hero__dock">
        {isLoading ? (
          <DetailsDockSkeleton />
        ) : (
          <>
            {heroCover}
            <div className="live-details-hero__dock-panel">
              {heroActions}
            </div>
          </>
        )}
      </div>
    </>
  );
}
