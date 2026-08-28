import React, { useId } from "react";

export function CineMark({
  size = 40,
  className = "",
  decorative = true,
}) {
  const uid = useId().replace(/:/g, "");
  const bgId = `cine-bg-${uid}`;
  const accentId = `cine-accent-${uid}`;
  const glowId = `cine-glow-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`cine-mark ${className}`.trim()}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative || undefined}
    >
      <defs>
        <linearGradient id={bgId} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#221836" />
          <stop offset="55%" stopColor="#120d1f" />
          <stop offset="100%" stopColor="#090612" />
        </linearGradient>
        <linearGradient id={accentId} x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--brand, #8b6dff)" />
          <stop offset="100%" stopColor="var(--stamp, #ff6b9d)" />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        d="M11 5 H53 L59 11 V53 L53 59 H11 L5 53 V11 Z"
        fill={`url(#${bgId})`}
        stroke={`url(#${accentId})`}
        strokeWidth="1.6"
      />
      <path
        d="M9 16 H55 L52 21 H12 Z"
        fill={`url(#${accentId})`}
        opacity="0.9"
      />
      <path d="M14 21 H18 V24 H14 Z M22 21 H26 V24 H22 Z M30 21 H34 V24 H30 Z M38 21 H42 V24 H38 Z M46 21 H50 V24 H46 Z" fill="#0d0a18" opacity="0.85" />

      <rect x="11" y="27" width="6" height="9" rx="1.6" fill={`url(#${accentId})`} opacity="0.88" />
      <rect x="11" y="39" width="6" height="9" rx="1.6" fill={`url(#${accentId})`} opacity="0.62" />
      <rect x="11" y="51" width="6" height="5" rx="1.4" fill={`url(#${accentId})`} opacity="0.38" />

      <path
        d="M29 30 L29 46 L45 38 Z"
        fill={`url(#${accentId})`}
        filter={`url(#${glowId})`}
      />

      <rect x="48" y="30" width="5" height="3.2" rx="1" fill={`url(#${accentId})`} opacity="0.82" />
      <rect x="48" y="36" width="5" height="3.2" rx="1" fill={`url(#${accentId})`} opacity="0.62" />
      <rect x="48" y="42" width="5" height="3.2" rx="1" fill={`url(#${accentId})`} opacity="0.42" />
      <rect x="48" y="48" width="5" height="3.2" rx="1" fill={`url(#${accentId})`} opacity="0.28" />
    </svg>
  );
}
