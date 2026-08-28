import React, { useEffect, useMemo, useState } from "react";
import Snowfall from "react-snowfall";
import { THEME_YOZAKURA } from "../../lib/theme/appearance";

const PETAL = "M16 2.4c-2.6 4.8-7.2 9.2-6.2 16.4.7 5 5.1 8.6 9.3 7.4 3.7-1 6.2-4.9 5.8-9.8C24.4 10.2 19.8 5.8 16 2.4Z";
const BLOSSOM = "M16 11.4c.3-2.4-.3-4.6-1.9-6.1 2 .3 3.7 1.4 4.6 3.1.9-1.7 2.6-2.8 4.6-3.1-1.5 1.5-2.2 3.7-1.9 6.1 2.2-.8 4.5-.6 6.3.7-1.8.9-3 2.7-3.2 4.8 2 .7 3.6 2.1 4.3 4.1-2-.5-4.3.1-5.8 1.6 1 2.1.8 4.5-.5 6.5-1-1.9-3-3.1-5.2-3.5-.9 2.2-2.9 3.8-5.3 4.3.6-2 .3-4.3-1.1-6.1-2-.1-3.3-3-3.7-5.2 2 .6 4.1.3 5.7-1C12 14 11 12.2 10.8 10.2c1.8 1.2 4.1 1.4 5.2 1.2Z";
const SOFT = "M16 4c-3.2 3.8-8 8.2-7.2 14.6.6 4.4 4.4 7.4 8.2 6.2 3.4-.9 5.6-4.6 5.2-9.2C21.8 10 18.6 6.2 16 4Z";

function petalUri(path, fill, center = "") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${center}<path fill="${fill}" d="${path}"/></svg>`;
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

const STAGE = {
  snowflakeCount: 64,
  radius: [11, 26],
  speed: [0.45, 1.35],
  wind: [-0.9, 1.3],
  opacity: [0.55, 0.95],
};

const FRAME = {
  snowflakeCount: 32,
  radius: [8, 18],
  speed: [0.35, 1.1],
  wind: [-0.7, 1.1],
  opacity: [0.32, 0.7],
};

export function SakuraPetals({ appearance, variant = "frame" }) {
  const night = appearance === THEME_YOZAKURA;
  const [images, setImages] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const config = variant === "stage" ? STAGE : FRAME;

  const uris = useMemo(() => (
    night
      ? [
        petalUri(PETAL, "#F3D0DC"),
        petalUri(BLOSSOM, "#E8A8BA", `<circle cx="16" cy="16" r="1.8" fill="#FFF4F7"/>`),
        petalUri(SOFT, "#C94F6D"),
      ]
      : [
        petalUri(PETAL, "#C94F6D"),
        petalUri(BLOSSOM, "#DB6A86", `<circle cx="16" cy="16" r="1.8" fill="#FFF4F7"/>`),
        petalUri(SOFT, "#E08AA3"),
      ]
  ), [night]);

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

  if (reducedMotion || !images?.length) return null;

  return (
    <div className={`sakura-fall sakura-fall--${variant}`} aria-hidden="true">
      <Snowfall
        images={images}
        enable3DRotation
        snowflakeCount={night ? Math.round(config.snowflakeCount * 0.72) : config.snowflakeCount}
        radius={config.radius}
        speed={config.speed}
        wind={config.wind}
        rotationSpeed={[-1.6, 1.6]}
        opacity={night ? [0.28, 0.72] : config.opacity}
        changeFrequency={120}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          background: "transparent",
        }}
      />
    </div>
  );
}
