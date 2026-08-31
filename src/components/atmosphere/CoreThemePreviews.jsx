import React from "react";

export function SakuraDayThemePreview() {
  return (
    <div className="sakura-day-preview" aria-hidden="true">
      <div className="sakura-day-preview__sky" />
      <div className="sakura-day-preview__sun" />
      <div className="sakura-day-preview__cloud sakura-day-preview__cloud--a" />
      <div className="sakura-day-preview__cloud sakura-day-preview__cloud--b" />
      <div className="sakura-day-preview__branch sakura-day-preview__branch--tl" />
      <div className="sakura-day-preview__branch sakura-day-preview__branch--tr" />
      <div className="sakura-day-preview__branch sakura-day-preview__branch--bl" />
      <div className="sakura-day-preview__branch sakura-day-preview__branch--br" />
      <div className="sakura-day-preview__blossoms" />
      <span className="sakura-day-preview__petal sakura-day-preview__petal--1" />
      <span className="sakura-day-preview__petal sakura-day-preview__petal--2" />
      <span className="sakura-day-preview__petal sakura-day-preview__petal--3" />
      <span className="sakura-day-preview__petal sakura-day-preview__petal--4" />
      <span className="sakura-day-preview__petal sakura-day-preview__petal--5" />
      <div className="sakura-day-preview__haze" />
      <div className="sakura-day-preview__veil" />
    </div>
  );
}

export function InkThemePreview() {
  return (
    <div className="ink-preview" aria-hidden="true">
      <div className="ink-preview__sky" />
      <div className="ink-preview__wash ink-preview__wash--a" />
      <div className="ink-preview__wash ink-preview__wash--b" />
      <div className="ink-preview__stroke ink-preview__stroke--tl" />
      <div className="ink-preview__stroke ink-preview__stroke--br" />
      <div className="ink-preview__moon" />
      <span className="ink-preview__mote ink-preview__mote--1" />
      <span className="ink-preview__mote ink-preview__mote--2" />
      <span className="ink-preview__mote ink-preview__mote--3" />
      <span className="ink-preview__mote ink-preview__mote--4" />
      <span className="ink-preview__mote ink-preview__mote--5" />
      <div className="ink-preview__veil" />
    </div>
  );
}

export function PaperThemePreview() {
  return (
    <div className="paper-preview" aria-hidden="true">
      <div className="paper-preview__sky" />
      <div className="paper-preview__fiber" />
      <div className="paper-preview__light" />
      <div className="paper-preview__shaft paper-preview__shaft--1" />
      <div className="paper-preview__shaft paper-preview__shaft--2" />
      <div className="paper-preview__wash" />
      <span className="paper-preview__dust paper-preview__dust--1" />
      <span className="paper-preview__dust paper-preview__dust--2" />
      <span className="paper-preview__dust paper-preview__dust--3" />
      <span className="paper-preview__dust paper-preview__dust--4" />
      <span className="paper-preview__dust paper-preview__dust--5" />
      <div className="paper-preview__veil" />
    </div>
  );
}
