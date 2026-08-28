export const FONT_SANS = "sans";
export const FONT_NASKH = "naskh";
export const FONT_KUFI = "kufi";
export const FONT_CLASSIC = "classic";

export const FONT_IDS = [FONT_SANS, FONT_NASKH, FONT_KUFI, FONT_CLASSIC];

export const TYPEFACES = {
  [FONT_SANS]: {
    id: FONT_SANS,
    sans: '"Noto Sans Arabic", "Instrument Sans", "Manrope", sans-serif',
    display: '"Noto Sans Arabic", "Instrument Sans", "Manrope", sans-serif',
    arabic: '"Noto Sans Arabic", "Alexandria", "Manrope", sans-serif',
    jp: '"Noto Sans JP", "Instrument Sans", sans-serif',
  },
  [FONT_NASKH]: {
    id: FONT_NASKH,
    sans: '"Noto Naskh Arabic", "Instrument Sans", serif',
    display: '"Noto Naskh Arabic", "Noto Serif JP", serif',
    arabic: '"Noto Naskh Arabic", "Amiri", serif',
    jp: '"Noto Serif JP", "Noto Naskh Arabic", serif',
  },
  [FONT_KUFI]: {
    id: FONT_KUFI,
    sans: '"Reem Kufi", "Unbounded", "Instrument Sans", sans-serif',
    display: '"Reem Kufi", "Unbounded", sans-serif',
    arabic: '"Reem Kufi", "Noto Sans Arabic", sans-serif',
    jp: '"Noto Sans JP", "Reem Kufi", sans-serif',
  },
  [FONT_CLASSIC]: {
    id: FONT_CLASSIC,
    sans: '"Instrument Sans", "Alexandria", sans-serif',
    display: '"Instrument Sans", "Alexandria", sans-serif',
    arabic: '"Alexandria", "Noto Sans Arabic", sans-serif',
    jp: '"Instrument Sans", sans-serif',
  },
};

const FONT_VAR_KEYS = ["sans", "display", "arabic", "jp"];

function asCssStack(value) {
  const family = String(value || "").trim();
  if (!family) return "";
  if (family.includes(",") || family.startsWith("var(")) return family;
  if (family.startsWith("\"")) return `${family}, sans-serif`;
  return `"${family.replaceAll('"', "")}", sans-serif`;
}

export function isTypefaceId(value) {
  return FONT_IDS.includes(value);
}

export function normalizeTypefaceId(value) {
  if (isTypefaceId(value)) return value;
  if (value && typeof value === "object" && isTypefaceId(value.id)) return value.id;
  return FONT_SANS;
}

export function resolveTypeface(value) {
  if (value && typeof value === "object") {
    if (isTypefaceId(value.id) && !value.family && !value.sans) {
      return TYPEFACES[value.id];
    }
    const family = asCssStack(value.sans || value.family);
    if (!family) return TYPEFACES[normalizeTypefaceId(value.id)];
    return {
      id: isTypefaceId(value.id) ? value.id : "custom",
      sans: family,
      display: asCssStack(value.display) || family,
      arabic: asCssStack(value.arabic) || family,
      jp: asCssStack(value.jp) || family,
    };
  }
  if (isTypefaceId(value)) return TYPEFACES[value];
  if (typeof value === "string" && value.trim()) {
    const stack = asCssStack(value);
    return { id: "custom", sans: stack, display: stack, arabic: stack, jp: stack };
  }
  return TYPEFACES[FONT_SANS];
}

function writeFontVars(element, typeface) {
  if (!element?.style) return;
  element.dataset.font = typeface.id;
  for (const key of FONT_VAR_KEYS) {
    element.style.setProperty(`--font-${key}`, typeface[key]);
  }
}

/**
 * Applique une police à toute l’application.
 *
 * Preset : `applyTypeface("sans" | "naskh" | "kufi" | "classic")`
 * Nom CSS : `applyTypeface("IBM Plex Sans Arabic")`
 * Pile    : `applyTypeface('"IBM Plex Sans Arabic", sans-serif')`
 * Objet   : `applyTypeface({ family: "Cairo", display: "Reem Kufi" })`
 */
export function applyTypeface(value) {
  const typeface = resolveTypeface(value);
  if (typeof document === "undefined") return typeface.id;
  writeFontVars(document.documentElement, typeface);
  if (document.body) writeFontVars(document.body, typeface);
  return typeface.id;
}

export function typefaceNameKey(value) {
  const id = normalizeTypefaceId(value);
  return {
    [FONT_SANS]: "settings.fontSans",
    [FONT_NASKH]: "settings.fontNaskh",
    [FONT_KUFI]: "settings.fontKufi",
    [FONT_CLASSIC]: "settings.fontClassic",
  }[id];
}

export function typefaceHintKey(value) {
  const id = normalizeTypefaceId(value);
  return {
    [FONT_SANS]: "settings.fontSansHint",
    [FONT_NASKH]: "settings.fontNaskhHint",
    [FONT_KUFI]: "settings.fontKufiHint",
    [FONT_CLASSIC]: "settings.fontClassicHint",
  }[id];
}
