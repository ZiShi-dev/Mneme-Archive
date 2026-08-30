import { getDefaultFlareSolverrUrl, readFlareSolverrAuth } from "../../src/lib/settings/flareSolverrUrl.js";

const GLOBAL_KEY = "__manhawFlareSolverrConfig";

function defaultConfig() {
  const baseUrl = getDefaultFlareSolverrUrl();
  if (!baseUrl) return null;
  return { baseUrl, ...readFlareSolverrAuth() };
}

export function configureFlareSolverr(getConfig) {
  globalThis[GLOBAL_KEY] = typeof getConfig === "function" ? getConfig : null;
}

export function getFlareSolverrConfig() {
  const getter = globalThis[GLOBAL_KEY];
  if (typeof getter === "function") {
    try {
      const config = getter();
      if (config?.baseUrl) return config;
      return null;
    } catch {
      return defaultConfig();
    }
  }
  return defaultConfig();
}
