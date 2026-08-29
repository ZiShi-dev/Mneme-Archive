import React, { useId } from "react";
import {
  THEME_LUNE_NEIGE,
  THEME_PAPER,
  THEME_SAKURA,
  THEME_YOZAKURA,
  isDarkTheme,
} from "../../lib/theme/appearance";

const PALETTES = {
  night: {
    bg: ["#24161c", "#120c10"],
    panel: "#f6f1ea",
    ink: "#efe8df",
    line: "rgba(239, 232, 223, 0.42)",
    accent: "#e8a8ba",
    accentDeep: "#c94f6d",
    ring: "rgba(255, 240, 245, 0.16)",
  },
  day: {
    bg: ["#fff9f6", "#f7e8ec"],
    panel: "#ffffff",
    ink: "#2f2428",
    line: "rgba(47, 36, 40, 0.22)",
    accent: "#e597b2",
    accentDeep: "#c94f6d",
    ring: "rgba(201, 79, 109, 0.2)",
  },
  snow: {
    bg: ["#1b2940", "#0d1522"],
    panel: "#eef4ff",
    ink: "#d6e6ff",
    line: "rgba(214, 230, 255, 0.34)",
    accent: "#8eb4e8",
    accentDeep: "#c8daf5",
    ring: "rgba(214, 230, 255, 0.2)",
  },
};

function resolvePalette(variant, appearance) {
  if (variant === "light") return PALETTES.day;
  if (variant === "dark") return PALETTES.night;
  if (appearance === THEME_LUNE_NEIGE) return PALETTES.snow;
  if (appearance === THEME_SAKURA || appearance === THEME_PAPER) return PALETTES.day;
  if (appearance === THEME_YOZAKURA || isDarkTheme(appearance)) return PALETTES.night;
  if (typeof document !== "undefined" && isDarkTheme(document.body?.dataset?.theme)) {
    return PALETTES.night;
  }
  return PALETTES.day;
}

function MnemeMarkArt({ palette, uid }) {
  const bgId = `mneme-bg-${uid}`;
  const glowId = `mneme-glow-${uid}`;

  return (
    <>
      <defs>
        <linearGradient id={bgId} x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={palette.bg[0]} />
          <stop offset="100%" stopColor={palette.bg[1]} />
        </linearGradient>
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="4" y="4" width="56" height="56" rx="17" fill={`url(#${bgId})`} />
      <rect
        x="4.5"
        y="4.5"
        width="55"
        height="55"
        rx="16.5"
        fill="none"
        stroke={palette.ring}
        strokeWidth="1"
      />

      <g filter={`url(#${glowId})`}>
        <circle cx="46" cy="17" r="5.2" fill={palette.accent} opacity="0.22" />
        <circle cx="46" cy="17" r="3.4" fill={palette.accent} />
        <circle cx="46" cy="17" r="1.1" fill={palette.panel} />
      </g>

      <path
        d="M17 21 C17 18.8, 30.5 17.2, 32 18.2 C33.5 17.2, 47 18.8, 47 21 V43 C33.8 46.8, 32 47.4, 32 47.4 C32 47.4, 30.2 46.8, 17 43 Z"
        fill={palette.panel}
        opacity="0.96"
      />
      <path
        d="M17 21 C17 18.8, 30.5 17.2, 32 18.2 C33.5 17.2, 47 18.8, 47 21 V43 C33.8 46.8, 32 47.4, 32 47.4 C32 47.4, 30.2 46.8, 17 43 Z"
        fill="none"
        stroke={palette.ink}
        strokeWidth="1.2"
        opacity="0.88"
      />
      <path d="M32 18.2 V47.2" stroke={palette.ink} strokeWidth="1.1" opacity="0.72" />

      <path d="M21 27 H27" stroke={palette.line} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M21 31.5 H28" stroke={palette.line} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M21 36 H26" stroke={palette.line} strokeWidth="1.6" strokeLinecap="round" />

      <path d="M37 27 H43" stroke={palette.line} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M36 31.5 H43" stroke={palette.line} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M37 36 H42" stroke={palette.line} strokeWidth="1.6" strokeLinecap="round" />

      <path
        d="M32 38 L36.8 41.2 L35.1 46.2 H28.9 L27.2 41.2 Z"
        fill={palette.accentDeep}
        opacity="0.92"
      />

      <circle cx="14" cy="46" r="1.1" fill={palette.accent} opacity="0.55" />
      <circle cx="50" cy="42" r="0.9" fill={palette.accent} opacity="0.42" />
    </>
  );
}

export function MnemeMark({
  size = 32,
  variant = "auto",
  appearance,
  alt = "Mneme Archive",
  decorative = true,
  className = "",
}) {
  const uid = useId().replace(/:/g, "");
  const palette = resolvePalette(variant, appearance);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`mneme-mark ${className}`.trim()}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : alt}
    >
      <MnemeMarkArt palette={palette} uid={uid} />
    </svg>
  );
}
