export const DEFAULT_COFLEX_BASE_URL = "https://coflix.esq";

export function normalizeCoflixBaseUrl(raw, { fallback = DEFAULT_COFLEX_BASE_URL } = {}) {
  const candidate = String(raw || "").trim() || fallback;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return DEFAULT_COFLEX_BASE_URL;
    return url.origin;
  } catch {
    return DEFAULT_COFLEX_BASE_URL;
  }
}
