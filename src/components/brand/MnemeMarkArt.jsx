import React from "react";
import { compassRosePath, sparklePath } from "./mnemeMarkGeometry.js";

export function MnemeMarkArt({ palette, uid }) {
  const glowId = `mneme-glow-${uid}`;
  const cx = 32;
  const cy = 32;

  return (
    <>
      <defs>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="0" y="0" width="64" height="64" rx="15" fill={palette.canvas} />
      <circle cx={cx} cy={cy} r="21.5" fill={palette.disk} />

      <circle
        cx={cx}
        cy={cy}
        r="27.5"
        fill="none"
        stroke={palette.ring}
        strokeWidth="0.9"
        opacity="0.88"
      />
      <circle cx={cx} cy="6.5" r="2.1" fill="none" stroke={palette.node} strokeWidth="0.85" />
      <circle cx="57.5" cy={cy} r="2.1" fill="none" stroke={palette.node} strokeWidth="0.85" />

      <path d={compassRosePath(cx, cy, 19.5, 10.5)} fill={palette.glyph} />

      <path d={sparklePath(cx - 11, cy - 11, 2.2)} fill={palette.glyphSoft} opacity="0.9" />
      <path d={sparklePath(cx + 11, cy - 11, 2.2)} fill={palette.glyphSoft} opacity="0.9" />
      <path d={sparklePath(cx - 11, cy + 11, 2.2)} fill={palette.glyphSoft} opacity="0.9" />
      <path d={sparklePath(cx + 11, cy + 11, 2.2)} fill={palette.glyphSoft} opacity="0.9" />

      <circle cx={cx} cy={cy} r="5.2" fill={palette.starGlow} opacity="0.22" filter={`url(#${glowId})`} />
      <path d={sparklePath(cx, cy, 4.6)} fill={palette.star} filter={`url(#${glowId})`} />
    </>
  );
}
