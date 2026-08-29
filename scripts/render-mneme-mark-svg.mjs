import { MNEME_MARK_PALETTES } from "../src/lib/brand/mnemeMarkPalettes.js";
import { compassRosePath, sparklePath } from "../src/components/brand/mnemeMarkGeometry.js";
import { THEME_INK } from "../src/lib/theme/appearance.js";

function renderMnemeMarkSvg(palette, size = 512) {
  const cx = 256;
  const cy = 256;
  const scale = size / 64;
  const r = (value) => value * scale;
  const glowBlur = 1.4 * scale;

  const rose = compassRosePath(cx, cy, r(19.5), r(10.5));
  const sparkles = [
    [cx - r(11), cy - r(11)],
    [cx + r(11), cy - r(11)],
    [cx - r(11), cy + r(11)],
    [cx + r(11), cy + r(11)],
  ]
    .map(([x, y]) => `<path d="${sparklePath(x, y, r(2.2))}" fill="${palette.glyphSoft}" opacity="0.9" />`)
    .join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Mneme Archive">
  <defs>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${glowBlur}" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" rx="${r(15)}" fill="${palette.canvas}" />
  <circle cx="${cx}" cy="${cy}" r="${r(21.5)}" fill="${palette.disk}" />
  <circle cx="${cx}" cy="${cy}" r="${r(27.5)}" fill="none" stroke="${palette.ring}" stroke-width="${r(0.9)}" opacity="0.88" />
  <circle cx="${cx}" cy="${r(6.5)}" r="${r(2.1)}" fill="none" stroke="${palette.node}" stroke-width="${r(0.85)}" />
  <circle cx="${size - r(6.5)}" cy="${cy}" r="${r(2.1)}" fill="none" stroke="${palette.node}" stroke-width="${r(0.85)}" />
  <path d="${rose}" fill="${palette.glyph}" />
  ${sparkles}
  <circle cx="${cx}" cy="${cy}" r="${r(5.2)}" fill="${palette.starGlow}" opacity="0.22" filter="url(#glow)" />
  <path d="${sparklePath(cx, cy, r(4.6))}" fill="${palette.star}" filter="url(#glow)" />
</svg>`;
}

export function renderMnemeMarkSvgForTheme(themeId = THEME_INK, size = 512) {
  const palette = MNEME_MARK_PALETTES[themeId] || MNEME_MARK_PALETTES[THEME_INK];
  return renderMnemeMarkSvg(palette, size);
}
