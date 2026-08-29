import React from "react";
import { THEME_SAKURA, THEME_YOZAKURA } from "../../lib/theme/appearance";

function BlossomCluster({ cx, cy, size, colors, filterId, keyId }) {
  const { petal, mid, core } = colors;
  return (
    <g key={keyId} filter={`url(#${filterId})`}>
      <circle cx={cx} cy={cy} r={size + 2.4} fill={mid} opacity={0.22} />
      <circle cx={cx} cy={cy} r={size + 0.8} fill={petal} opacity={0.78} />
      <circle cx={cx} cy={cy} r={size * 0.34} fill={core} />
    </g>
  );
}

function BranchGlowFilter({ idSuffix, night }) {
  const filterId = `sakura-glow-${night ? "night" : "day"}-${idSuffix}`;
  return (
    <defs>
      <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation={night ? 2.2 : 1.4} result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

function CornerBranch({ night, mirror = false, idSuffix = "a", dense = false }) {
  const branch = night ? "#5a3842" : "#6b4540";
  const branchDeep = night ? "#2d1a22" : "#4f322e";
  const colors = {
    petal: night ? "#fff0f5" : "#ffd8e6",
    mid: night ? "#f4cad5" : "#e8a8ba",
    core: night ? "#e8a8ba" : "#c94f6d",
  };
  const filterId = `sakura-glow-${night ? "night" : "day"}-${idSuffix}`;

  const blossoms = dense
    ? [
      [34, 28, 7], [52, 22, 6], [70, 34, 8], [88, 48, 7], [48, 52, 6],
      [64, 64, 7], [82, 76, 8], [98, 90, 6], [76, 104, 7], [104, 108, 5],
      [38, 78, 5], [58, 88, 6], [92, 62, 5], [24, 48, 4], [110, 42, 4],
    ]
    : [
      [34, 28, 7], [52, 22, 6], [70, 34, 8], [88, 48, 7], [48, 52, 6],
      [64, 64, 7], [82, 76, 8], [98, 90, 6], [76, 104, 7], [104, 108, 5],
    ];

  return (
    <svg
      viewBox="0 0 220 180"
      className="sakura-branches__svg"
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
    >
      <BranchGlowFilter idSuffix={idSuffix} night={night} />
      <path d="M8 0 C 28 18, 42 42, 54 72 S 82 128, 96 168" fill="none" stroke={branchDeep} strokeWidth="5.5" strokeLinecap="round" />
      <path d="M8 0 C 28 18, 42 42, 54 72 S 82 128, 96 168" fill="none" stroke={branch} strokeWidth="2.8" strokeLinecap="round" />
      <path d="M42 38 C 58 34, 72 40, 84 52" fill="none" stroke={branch} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M54 72 C 68 66, 86 70, 102 82" fill="none" stroke={branch} strokeWidth="2" strokeLinecap="round" />
      <path d="M68 98 C 82 92, 98 96, 112 108" fill="none" stroke={branch} strokeWidth="1.8" strokeLinecap="round" />
      {dense ? (
        <path d="M30 58 C 18 62, 8 74, 4 88" fill="none" stroke={branch} strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
      ) : null}
      {blossoms.map(([cx, cy, r]) => (
        <BlossomCluster
          key={`${idSuffix}-${cx}-${cy}`}
          keyId={`${idSuffix}-${cx}-${cy}`}
          cx={cx}
          cy={cy}
          size={r}
          colors={colors}
          filterId={filterId}
        />
      ))}
    </svg>
  );
}

function NightCanopy({ idSuffix = "canopy" }) {
  const branch = "#4a3038";
  const branchDeep = "#2d1a22";
  const colors = { petal: "#fff0f5", mid: "#f4cad5", core: "#e8a8ba" };
  const filterId = `sakura-glow-night-${idSuffix}`;

  const blossoms = [
    [118, 42, 8], [142, 36, 7], [164, 48, 6], [96, 52, 7], [128, 58, 8],
    [152, 64, 6], [178, 56, 5], [84, 68, 6], [108, 74, 7], [136, 78, 8],
    [160, 82, 6], [188, 72, 5], [72, 82, 5], [200, 88, 4], [124, 92, 5],
  ];

  return (
    <svg viewBox="0 0 260 120" className="sakura-branches__arch" aria-hidden="true">
      <BranchGlowFilter idSuffix={idSuffix} night />
      <path d="M0 18 C 36 12, 72 8, 108 28 C 132 42, 148 58, 162 72" fill="none" stroke={branchDeep} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M0 18 C 36 12, 72 8, 108 28 C 132 42, 148 58, 162 72" fill="none" stroke={branch} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M260 18 C 224 12, 188 8, 152 28 C 128 42, 112 58, 98 72" fill="none" stroke={branchDeep} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M260 18 C 224 12, 188 8, 152 28 C 128 42, 112 58, 98 72" fill="none" stroke={branch} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M108 28 C 118 44, 124 62, 130 78" fill="none" stroke={branch} strokeWidth="2" strokeLinecap="round" />
      <path d="M152 28 C 142 44, 136 62, 130 78" fill="none" stroke={branch} strokeWidth="2" strokeLinecap="round" />
      <path d="M48 34 C 62 42, 74 54, 82 66" fill="none" stroke={branch} strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
      <path d="M212 34 C 198 42, 186 54, 178 66" fill="none" stroke={branch} strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
      {blossoms.map(([cx, cy, r]) => (
        <BlossomCluster
          key={`canopy-${cx}-${cy}`}
          keyId={`canopy-${cx}-${cy}`}
          cx={cx}
          cy={cy}
          size={r}
          colors={colors}
          filterId={filterId}
        />
      ))}
    </svg>
  );
}

export function SakuraBranches({ appearance, variant = "frame" }) {
  const night = appearance === THEME_YOZAKURA;
  const day = appearance === THEME_SAKURA;

  if (!night && !day) return null;

  if (variant === "bottom") {
    return (
      <div
        className={`sakura-branches sakura-branches--bottom ${night ? "sakura-branches--night" : "sakura-branches--day"}`}
        aria-hidden="true"
      >
        {night ? <div className="sakura-branches__glow sakura-branches__glow--bottom" /> : null}
        <div className={`sakura-branches__corner sakura-branches__corner--bl ${night ? "sakura-branches__corner--night" : ""}`}>
          <CornerBranch night={night} dense={night} idSuffix="nbl" />
        </div>
        <div className={`sakura-branches__corner sakura-branches__corner--br ${night ? "sakura-branches__corner--night" : ""}`}>
          <CornerBranch night={night} dense={night} mirror idSuffix="nbr" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`sakura-branches sakura-branches--${variant} ${night ? "sakura-branches--night" : "sakura-branches--day"}`}
      aria-hidden="true"
    >
      {night ? (
        <>
          <div className="sakura-branches__sky" />
          <div className="sakura-branches__glow sakura-branches__glow--left" />
          <div className="sakura-branches__glow sakura-branches__glow--right" />
          <div className="sakura-branches__arch-wrap">
            <NightCanopy />
          </div>
          <div className="sakura-branches__corner sakura-branches__corner--tl sakura-branches__corner--night">
            <CornerBranch night dense idSuffix="ntl" />
          </div>
          <div className="sakura-branches__corner sakura-branches__corner--tr sakura-branches__corner--night">
            <CornerBranch night dense mirror idSuffix="ntr" />
          </div>
          <div className="sakura-branches__glow sakura-branches__glow--bottom" />
          <div className="sakura-branches__corner sakura-branches__corner--bl sakura-branches__corner--night">
            <CornerBranch night dense idSuffix="nbl" />
          </div>
          <div className="sakura-branches__corner sakura-branches__corner--br sakura-branches__corner--night">
            <CornerBranch night dense mirror idSuffix="nbr" />
          </div>
          <div className="sakura-branches__sparkles" />
        </>
      ) : (
        <>
          <div className="sakura-branches__corner sakura-branches__corner--tl">
            <CornerBranch night={false} idSuffix="tl" />
          </div>
          <div className="sakura-branches__corner sakura-branches__corner--tr">
            <CornerBranch night={false} mirror idSuffix="tr" />
          </div>
          <div className="sakura-branches__corner sakura-branches__corner--bl">
            <CornerBranch night={false} idSuffix="bl" />
          </div>
          <div className="sakura-branches__corner sakura-branches__corner--br">
            <CornerBranch night={false} mirror idSuffix="br" />
          </div>
        </>
      )}
    </div>
  );
}
