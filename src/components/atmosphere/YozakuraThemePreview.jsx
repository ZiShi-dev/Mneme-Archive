import React from "react";

export function YozakuraThemePreview() {
  return (
    <div className="yozakura-preview" aria-hidden="true">
      <div className="yozakura-preview__sky" />
      <div className="yozakura-preview__glow yozakura-preview__glow--tl" />
      <div className="yozakura-preview__glow yozakura-preview__glow--br" />
      <div className="yozakura-preview__stars" />
      <div className="yozakura-preview__moon">
        <span className="yozakura-preview__moon-disc" />
        <span className="yozakura-preview__moon-glow" />
      </div>
      <div className="yozakura-preview__branch yozakura-preview__branch--tl" />
      <div className="yozakura-preview__branch yozakura-preview__branch--tr" />
      <div className="yozakura-preview__branch yozakura-preview__branch--bl" />
      <div className="yozakura-preview__branch yozakura-preview__branch--br" />
      <div className="yozakura-preview__blossoms" />
      <span className="yozakura-preview__petal yozakura-preview__petal--1" />
      <span className="yozakura-preview__petal yozakura-preview__petal--2" />
      <span className="yozakura-preview__petal yozakura-preview__petal--3" />
      <span className="yozakura-preview__petal yozakura-preview__petal--4" />
      <span className="yozakura-preview__petal yozakura-preview__petal--5" />
      <span className="yozakura-preview__petal yozakura-preview__petal--6" />
      <div className="yozakura-preview__veil" />
    </div>
  );
}
