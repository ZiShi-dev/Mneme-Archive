/** Profil de scène Yozakura selon le viewport — pas un modèle d’appareil. */

export function yozakuraAspect(w, h) {
  return w / Math.max(1, h);
}

export function isYozakuraLandscape(w, h) {
  return yozakuraAspect(w, h) >= 1.25;
}

export function isYozakuraWide(w, h) {
  return w >= 720 && yozakuraAspect(w, h) >= 1.15;
}

export function isYozakuraCompact(w, h) {
  return w < 360 || h < 480;
}

export function isYozakuraShortLandscape(w, h) {
  return h <= 520 && w > h;
}

/** Taille des arbres : coincée pour ne pas envahir tablette / bureau. */
export function yozakuraTreeUnit(w, h) {
  if (isYozakuraLandscape(w, h)) {
    return Math.min(h * 1.05, 520);
  }
  return Math.min(Math.min(w, h), 560);
}

export function yozakuraMoonPosition(w, h, variant = "frame") {
  const unit = yozakuraTreeUnit(w, h);
  const landscape = isYozakuraLandscape(w, h);
  const wide = isYozakuraWide(w, h);
  return {
    x: landscape || wide ? w * 0.86 : w * 0.74,
    y: landscape ? Math.min(h * 0.22, 88) : h * 0.115,
    r: unit * (variant === "stage" ? 0.052 : 0.064),
  };
}

const NEAR_ANCHORS = [
  { x: -0.03, y: 0.03, angle: 0.62, len: 0.66, w: 11 },
  { x: 1.03, y: -0.02, angle: Math.PI - 0.52, len: 0.72, w: 12 },
  { x: 0.38, y: -0.04, angle: 1.32, len: 0.3, w: 5.5, depth: 1 },
  { x: 1.04, y: 0.97, angle: Math.PI + 0.72, len: 0.5, w: 9 },
  { x: -0.04, y: 0.9, angle: -0.42, len: 0.46, w: 8 },
];

const FAR_ANCHORS = [
  { x: 0.58, y: -0.03, angle: 1.85, len: 0.4, w: 4.5, depth: 1 },
  { x: -0.03, y: 0.44, angle: 0.12, len: 0.42, w: 4.5, depth: 1 },
  { x: 1.03, y: 0.56, angle: Math.PI + 0.08, len: 0.36, w: 4, depth: 1 },
];

const WIDE_NEAR_ANCHORS = [
  { x: -0.02, y: 0.22, angle: 0.28, len: 0.52, w: 8 },
  { x: 1.02, y: 0.28, angle: Math.PI - 0.22, len: 0.5, w: 8 },
];

const WIDE_FAR_ANCHORS = [
  { x: 0.12, y: -0.02, angle: 1.4, len: 0.34, w: 4, depth: 1 },
  { x: 0.88, y: -0.02, angle: 1.75, len: 0.34, w: 4, depth: 1 },
];

export function yozakuraTreeAnchors(w, h) {
  if (!isYozakuraWide(w, h)) {
    return { near: NEAR_ANCHORS, far: FAR_ANCHORS };
  }
  return {
    near: [...NEAR_ANCHORS, ...WIDE_NEAR_ANCHORS],
    far: [...FAR_ANCHORS, ...WIDE_FAR_ANCHORS],
  };
}

function clampCount(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function yozakuraMotionBudget({
  w,
  h,
  variant = "frame",
  native = false,
  saveData = false,
  devicePixelRatio = 1,
} = {}) {
  const stage = variant === "stage";
  const areaScale = Math.min(1.2, Math.max(0.5, (w * h) / (390 * 844)));
  const short = isYozakuraShortLandscape(w, h);
  const compact = isYozakuraCompact(w, h);

  let petals = (stage ? 54 : 42) * areaScale;
  let bokeh = (stage ? 18 : 14) * areaScale;
  let twinkles = (stage ? 70 : 54) * areaScale;
  let lanterns = stage ? 8 : 6;
  let staticStars = stage ? 340 : 260;

  if (short || compact) {
    petals *= 0.55;
    bokeh *= 0.5;
    twinkles *= 0.65;
    lanterns -= 2;
    staticStars *= 0.7;
  }
  if (native) {
    petals *= 0.72;
    twinkles *= 0.75;
    staticStars = stage ? 220 : 170;
  }
  if (saveData) {
    petals = Math.min(14, petals);
    bokeh = Math.min(6, bokeh);
    twinkles = Math.min(24, twinkles);
    lanterns = 2;
    staticStars = Math.min(120, staticStars);
  }

  const dprCap = native || compact || saveData ? 1.5 : 2;

  return {
    petals: clampCount(petals, 10, 64),
    bokeh: clampCount(bokeh, 4, 22),
    twinkles: clampCount(twinkles, 16, 80),
    lanterns: clampCount(lanterns, 2, 10),
    staticStars: clampCount(staticStars, 80, 360),
    dpr: Math.min(Math.max(1, devicePixelRatio), dprCap),
    farTrees: !native,
  };
}
