export const VIDEO_COMPLETE_THRESHOLD = 92;
export const EMBED_TICK_MS = 15000;
export const EMBED_SECONDS_PER_PERCENT = 45;
export const EMBED_PROGRESS_CAP = 91;
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
export const SKIP_SECONDS = 10;
export const CHROME_IDLE_MS = 4500;
export const FULLSCREEN_CHROME_IDLE_MS = 4500;
export const NETFLIX_CHROME_IDLE_MS = 6500;
export const CHROME_INTERACTION_END_MS = 1200;
export const DOUBLE_TAP_MS = 320;
export const SINGLE_TAP_DELAY_MS = 280;
export const SKIP_ZONE_RATIO = 0.38;

export function formatServerLabel(source = {}, translate) {
  const label = String(source.label || "").trim();
  if (/^anime4up[12]$/i.test(label)) {
    return translate("reader.stream.serverN", { n: label.replace(/anime4up/i, "") });
  }
  return label || translate("reader.stream.server");
}

/** Ajoute un numéro quand plusieurs lecteurs portent le même nom (ex. Mp4upload ×3). */
export function formatUniqueServerLabels(sources = [], translate) {
  const baseLabels = sources.map((source) => formatServerLabel(source, translate));
  const totals = new Map();
  for (const label of baseLabels) {
    totals.set(label, (totals.get(label) || 0) + 1);
  }
  const seen = new Map();
  return baseLabels.map((label) => {
    const total = totals.get(label) || 1;
    if (total <= 1) return label;
    const next = (seen.get(label) || 0) + 1;
    seen.set(label, next);
    return `${label} ${next}`;
  });
}
