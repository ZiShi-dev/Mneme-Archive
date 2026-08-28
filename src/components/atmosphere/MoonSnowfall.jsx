import React, { useEffect, useMemo, useState } from "react";
import Snowfall from "react-snowfall";

function snowflakeUri(stroke, fill = "none", detail = true) {
  const star = detail
    ? `<path d="M16 8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" opacity=".5"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <g fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linecap="round">
      <circle cx="16" cy="16" r="1.5"/>
      <path d="M16 4v24M4 16h24M7.8 7.8l16.4 16.4M24.2 7.8 7.8 24.2"/>
      ${star}
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadImages(uris) {
  return Promise.all(uris.map((src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  })));
}

const LAYER_STYLE = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
  background: "transparent",
};

const STAGE_NEAR = {
  snowflakeCount: 72,
  radius: [6, 16],
  speed: [0.35, 0.95],
  wind: [-0.55, 1.1],
  opacity: [0.55, 0.98],
};

const STAGE_FAR = {
  snowflakeCount: 140,
  radius: [1.5, 5],
  speed: [0.25, 0.75],
  wind: [-0.8, 1.4],
  opacity: [0.22, 0.55],
};

const FRAME_NEAR = {
  snowflakeCount: 44,
  radius: [5, 13],
  speed: [0.3, 0.85],
  wind: [-0.45, 0.95],
  opacity: [0.5, 0.95],
};

const FRAME_FAR = {
  snowflakeCount: 88,
  radius: [1.2, 4.5],
  speed: [0.2, 0.65],
  wind: [-0.65, 1.2],
  opacity: [0.18, 0.48],
};

export function MoonSnowfall({ variant = "frame" }) {
  const [images, setImages] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const isStage = variant === "stage";
  const near = isStage ? STAGE_NEAR : FRAME_NEAR;
  const far = isStage ? STAGE_FAR : FRAME_FAR;

  const uris = useMemo(() => ([
    snowflakeUri("rgba(255,255,255,.98)"),
    snowflakeUri("rgba(232,242,255,.95)", "rgba(232,242,255,.2)"),
    snowflakeUri("rgba(200,220,248,.9)", "rgba(200,220,248,.14)", false),
    snowflakeUri("rgba(255,255,255,.85)", "none", false),
  ]), []);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(Boolean(media?.matches));
    sync();
    media?.addEventListener?.("change", sync);
    return () => media?.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    if (reducedMotion) return undefined;
    let cancelled = false;
    loadImages(uris).then((next) => {
      if (!cancelled) setImages(next);
    }).catch(() => {
      if (!cancelled) setImages(null);
    });
    return () => { cancelled = true; };
  }, [reducedMotion, uris]);

  if (reducedMotion) return null;

  return (
    <div className={`moon-snow-fall moon-snow-fall--${variant}`} aria-hidden="true">
      <div className="moon-snow-fall__layer moon-snow-fall__layer--far">
        <Snowfall
          color="rgba(232, 242, 255, 0.75)"
          snowflakeCount={far.snowflakeCount}
          radius={far.radius}
          speed={far.speed}
          wind={far.wind}
          rotationSpeed={[-0.4, 0.4]}
          opacity={far.opacity}
          changeFrequency={180}
          style={LAYER_STYLE}
        />
      </div>
      <div className="moon-snow-fall__layer moon-snow-fall__layer--near">
        <Snowfall
          images={images ?? undefined}
          color="#F5FAFF"
          enable3DRotation
          snowflakeCount={near.snowflakeCount}
          radius={near.radius}
          speed={near.speed}
          wind={near.wind}
          rotationSpeed={[-1.2, 1.2]}
          opacity={near.opacity}
          changeFrequency={120}
          style={LAYER_STYLE}
        />
      </div>
    </div>
  );
}
