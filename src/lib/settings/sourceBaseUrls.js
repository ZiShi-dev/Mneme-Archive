import { sourceProfiles } from "../../config/sources.js";
import { DEFAULT_COFLEX_BASE_URL, normalizeCoflixBaseUrl } from "./coflixBaseUrl.js";

export function getDefaultSourceBaseUrl(sourceId) {
  const profile = sourceProfiles[sourceId];
  if (!profile?.url) return "";
  try {
    return new URL(profile.url).origin;
  } catch {
    return "";
  }
}

export function normalizeSourceBaseUrl(sourceId, raw, { fallback } = {}) {
  const defaultUrl = fallback || getDefaultSourceBaseUrl(sourceId);
  const candidate = String(raw ?? "").trim();
  if (!candidate) return defaultUrl;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return defaultUrl;
    return url.origin;
  } catch {
    return defaultUrl;
  }
}

export function normalizeSourceBaseUrlOverrides(raw, { legacyCoflixBaseUrl } = {}) {
  const overrides = {};

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [sourceId, value] of Object.entries(raw)) {
      if (!sourceProfiles[sourceId]) continue;
      const normalized = normalizeSourceBaseUrl(sourceId, value);
      const defaultUrl = getDefaultSourceBaseUrl(sourceId);
      if (normalized && defaultUrl && normalized !== defaultUrl) {
        overrides[sourceId] = normalized;
      }
    }
  }

  const legacyCoflix = normalizeCoflixBaseUrl(legacyCoflixBaseUrl, { fallback: DEFAULT_COFLEX_BASE_URL });
  const defaultCoflix = getDefaultSourceBaseUrl("coflix") || DEFAULT_COFLEX_BASE_URL;
  if (legacyCoflix && legacyCoflix !== defaultCoflix) {
    overrides.coflix = legacyCoflix;
  }

  return overrides;
}

export function getEffectiveSourceBaseUrl(sourceId, overrides = {}) {
  return overrides[sourceId] || getDefaultSourceBaseUrl(sourceId);
}

export function countSourceBaseUrlOverrides(overrides = {}) {
  return Object.keys(overrides).length;
}

export function listConfigurableSourceIds() {
  return Object.keys(sourceProfiles);
}
