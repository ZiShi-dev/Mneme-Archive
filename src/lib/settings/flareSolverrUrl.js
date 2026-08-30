/** Proxy Night-Novel : FlareSolverr reste privé, l’app n’embarque aucun mot de passe. */
export const BUILTIN_FLARESOLVERR_URL = "https://nightnovelapp.tech/api/public/flare";

function readEnvFlareSolverrUrl() {
  let viteUrl = "";
  try {
    viteUrl = String(import.meta.env?.VITE_FLARESOLVERR_URL ?? "").trim();
  } catch {
    viteUrl = "";
  }
  const nodeEnv = globalThis.process?.env;
  const nodeUrl = String(nodeEnv?.FLARESOLVERR_URL || nodeEnv?.VITE_FLARESOLVERR_URL || "").trim();
  return viteUrl || nodeUrl;
}

export function normalizeFlareSolverrUrl(raw, { fallback = "" } = {}) {
  const candidate = String(raw ?? "").trim() || fallback;
  if (!candidate) return fallback;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

export function getDefaultFlareSolverrUrl() {
  return normalizeFlareSolverrUrl(readEnvFlareSolverrUrl(), {
    fallback: BUILTIN_FLARESOLVERR_URL,
  });
}

export function isFlareSolverrConfigured(raw) {
  return Boolean(normalizeFlareSolverrUrl(raw, { fallback: getDefaultFlareSolverrUrl() }));
}

function readEnvValue(viteKey, nodeKeys) {
  let viteValue = "";
  try {
    viteValue = String(import.meta.env?.[viteKey] ?? "").trim();
  } catch {
    viteValue = "";
  }
  const nodeEnv = globalThis.process?.env;
  const nodeValue = nodeKeys
    .map((key) => String(nodeEnv?.[key] || "").trim())
    .find(Boolean) || "";
  return viteValue || nodeValue;
}

export function readFlareSolverrAuth() {
  return {
    apiKey: readEnvValue("VITE_FLARESOLVERR_API_KEY", ["FLARESOLVERR_API_KEY", "VITE_FLARESOLVERR_API_KEY"]),
    basicUser: readEnvValue("VITE_FLARESOLVERR_USER", ["FLARESOLVERR_USER", "VITE_FLARESOLVERR_USER"]) || "manhaw",
    basicPassword: readEnvValue("VITE_FLARESOLVERR_PASSWORD", ["FLARESOLVERR_PASSWORD", "VITE_FLARESOLVERR_PASSWORD"]),
  };
}
