import React from "react";
import { DetailsDockSkeleton } from "../../../components/ui/ContentSkeleton";
import { DETAILS_HERO_LAYOUT } from "./detailsLayout";

export function DetailsCinematicHero({
  heroLayout,
  status,
  heroCover,
  heroMeta,
  heroActions,
}) {
  const isLoading = status === "loading";
  const isReadingLayout = heroLayout === DETAILS_HERO_LAYOUT.READING;

  if (isReadingLayout) {
    return (
      <>
        <div className="live-details-hero__content live-details-hero__content--reading">
          {isLoading ? <DetailsDockSkeleton /> : heroCover}
          <div className="live-details-hero__reading-panel">
            {heroMeta}
          </div>
        </div>
        {!isLoading && heroActions ? (
          <div className="live-details-hero__actions">
            {heroActions}
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
