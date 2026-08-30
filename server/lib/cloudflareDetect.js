/** Signaux forts : page de challenge dédiée. */
const HARD_CF_PATTERN = /Just a moment|Attention Required!?|Checking your browser/i;

/** Signaux faibles : scripts CF présents aussi sur des pages légitimes. */
const SOFT_CF_PATTERN = /cf-chl-|cdn-cgi\/challenge-platform|cf-browser-verification|cf-turnstile|__cf_chl_opt|challenges\.cloudflare\.com/i;

/** Marqueurs de contenu réel (catalogue, chapitre, lecteur). */
const CONTENT_MARKERS = /novel-item|novel-list|page-item-detail|wp-manga|manga-item|bg-card|data-wor-library|wor-library|wor-single-novel|wor-reader|epcontent|reading-content|text-chapter|ts-post-image|<article\b/i;

export const CLOUDFLARE_CHALLENGE_PATTERN = new RegExp(
  `${HARD_CF_PATTERN.source}|${SOFT_CF_PATTERN.source}`,
  HARD_CF_PATTERN.flags,
);

export function isCloudflareChallengeHtml(html = "") {
  if (!html) return false;
  if (HARD_CF_PATTERN.test(html)) return true;
  if (SOFT_CF_PATTERN.test(html) && !CONTENT_MARKERS.test(html)) return true;
  return false;
}

/** Valide une page seulement si elle n’est pas un challenge CF et passe le test métier. */
export function isValidSourceHtml(html, looksValid) {
  if (!html || isCloudflareChallengeHtml(html)) return false;
  return typeof looksValid === "function" ? looksValid(html) : true;
}
