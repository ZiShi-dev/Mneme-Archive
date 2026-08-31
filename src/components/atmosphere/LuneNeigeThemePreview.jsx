import React from "react";

const NEAR_FLAKES = [
  { left: "6%", size: 8, opacity: 0.82, duration: 3.6, delay: 0, drift: 6, spin: 5.5 },
  { left: "16%", size: 6, opacity: 0.58, duration: 4.4, delay: 0.7, drift: -5, spin: 6.8 },
  { left: "26%", size: 7, opacity: 0.68, duration: 3.9, delay: 1.3, drift: 7, spin: 5.2 },
  { left: "36%", size: 5, opacity: 0.52, duration: 5, delay: 0.2, drift: -4, spin: 7.4 },
  { left: "46%", size: 8, opacity: 0.76, duration: 3.4, delay: 1.9, drift: 5, spin: 4.8 },
  { left: "56%", size: 6, opacity: 0.6, duration: 4.6, delay: 1, drift: -6, spin: 6.2 },
  { left: "66%", size: 9, opacity: 0.84, duration: 3.2, delay: 0.4, drift: 8, spin: 5 },
  { left: "76%", size: 6, opacity: 0.56, duration: 4.8, delay: 1.6, drift: -5, spin: 7 },
  { left: "86%", size: 7, opacity: 0.7, duration: 4.1, delay: 2.4, drift: 6, spin: 5.6 },
  { left: "94%", size: 5, opacity: 0.48, duration: 5.2, delay: 3, drift: -3, spin: 8 },
];

const FAR_FLAKES = [
  { left: "10%", size: 3, opacity: 0.38, duration: 2.6, delay: 0.1, drift: 3 },
  { left: "22%", size: 2.5, opacity: 0.32, duration: 2.9, delay: 0.9, drift: -2 },
  { left: "34%", size: 3, opacity: 0.35, duration: 2.4, delay: 1.5, drift: 4 },
  { left: "48%", size: 2.5, opacity: 0.3, duration: 3.1, delay: 0.4, drift: -3 },
  { left: "60%", size: 3, opacity: 0.36, duration: 2.7, delay: 2.1, drift: 3 },
  { left: "72%", size: 2.5, opacity: 0.33, duration: 3, delay: 1.2, drift: -2 },
  { left: "84%", size: 3, opacity: 0.34, duration: 2.5, delay: 2.8, drift: 4 },
];

function GlassSnowflake({ size, variant = "near" }) {
  if (variant === "far") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <circle cx="12" cy="12" r="2.2" fill="rgba(238,244,255,0.9)" />
        <g stroke="rgba(214,230,255,0.55)" strokeWidth="0.9" strokeLinecap="round">
          <path d="M12 8v8M8 12h8" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="lune-neige-preview__flake-art">
      <circle cx="12" cy="12" r="9" fill="rgba(214,230,255,0.16)" stroke="rgba(232,242,255,0.48)" strokeWidth="0.8" />
      <g stroke="rgba(238,244,255,0.92)" strokeWidth="1.1" strokeLinecap="round">
        <path d="M12 4.5v15M4.5 12h15M7.2 7.2l9.6 9.6M16.8 7.2 7.2 16.8" />
      </g>
    </svg>
  );
}

function SnowLayer({ flakes, variant = "near" }) {
  return (
    <>
      {flakes.map((flake) => (
        <span
          key={`${variant}-${flake.left}-${flake.delay}`}
          className={`lune-neige-preview__flake lune-neige-preview__flake--${variant}`}
          style={{
            left: flake.left,
            "--flake-duration": `${flake.duration}s`,
            "--flake-delay": `${flake.delay}s`,
            "--flake-opacity": flake.opacity,
            "--flake-drift": `${flake.drift}px`,
            "--flake-spin": `${flake.spin || 6}s`,
            "--flake-rest-top": `${16 + (flake.delay * 13) % 54}%`,
          }}
        >
          <GlassSnowflake size={flake.size} variant={variant} />
        </span>
      ))}
    </>
  );
}

export function LuneNeigeThemePreview() {
  return (
    <div className="lune-neige-preview" aria-hidden="true">
      <div className="lune-neige-preview__sea">
        <span className="lune-neige-preview__sea-wave lune-neige-preview__sea-wave--a" />
        <span className="lune-neige-preview__sea-wave lune-neige-preview__sea-wave--b" />
        <span className="lune-neige-preview__sea-wave lune-neige-preview__sea-wave--c" />
        <span className="lune-neige-preview__moon-reflection" />
        <span className="lune-neige-preview__sea-glint lune-neige-preview__sea-glint--1" />
        <span className="lune-neige-preview__sea-glint lune-neige-preview__sea-glint--2" />
        <span className="lune-neige-preview__sea-glint lune-neige-preview__sea-glint--3" />
        <span className="lune-neige-preview__sea-glint lune-neige-preview__sea-glint--4" />
      </div>
      <div className="lune-neige-preview__aurora" />
      <div className="lune-neige-preview__stars" />
      <div className="lune-neige-preview__moon">
        <span className="lune-neige-preview__moon-disc" />
        <span className="lune-neige-preview__moon-glow" />
      </div>
      <div className="lune-neige-preview__snow lune-neige-preview__snow--far">
        <SnowLayer flakes={FAR_FLAKES} variant="far" />
      </div>
      <div className="lune-neige-preview__snow lune-neige-preview__snow--near">
        <SnowLayer flakes={NEAR_FLAKES} variant="near" />
      </div>
      <div className="lune-neige-preview__veil" />
    </div>
  );
}
