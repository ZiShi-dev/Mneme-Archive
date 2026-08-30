import { isCloudflareChallengeHtml } from "./cloudflareDetect.js";

const DEFAULT_TIMEOUT_MS = 60_000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isFlareProxyUrl(baseUrl) {
  const trimmed = String(baseUrl || "").trim().replace(/\/+$/, "");
  try {
    const path = new URL(trimmed).pathname.replace(/\/+$/, "");
    return path === "/api/public/flare" || path.endsWith("/api/public/flare");
  } catch {
    return false;
  }
}

function buildFlareSolverrEndpoint(baseUrl) {
  const trimmed = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (isFlareProxyUrl(trimmed)) return `${trimmed}/solve`;
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function toBase64(value) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }
  return btoa(value);
}

function extractHtml(payload, proxyMode) {
  if (proxyMode) {
    if (payload?.success === false) {
      throw new Error(payload.error || "FlareSolverr a échoué");
    }
    return typeof payload?.html === "string" ? payload.html : "";
  }
  if (payload?.status !== "ok") {
    throw new Error(payload?.message || "FlareSolverr a échoué");
  }
  return typeof payload?.solution?.response === "string" ? payload.solution.response : "";
}

export async function fetchHtmlViaFlareSolverr(url, {
  baseUrl,
  apiKey = "",
  basicUser = "",
  basicPassword = "",
  maxTimeout = DEFAULT_TIMEOUT_MS,
  session,
  fetchImpl = fetch,
} = {}) {
  if (!baseUrl) throw new Error("FlareSolverr non configuré");

  const proxyMode = isFlareProxyUrl(baseUrl);
  const endpoint = buildFlareSolverrEndpoint(baseUrl);
  const body = proxyMode
    ? { url }
    : {
      cmd: "request.get",
      url,
      maxTimeout,
      ...(session ? { session } : {}),
    };

  const headers = { "Content-Type": "application/json" };
  if (!proxyMode && apiKey) headers["X-FlareSolverr-Api-Key"] = apiKey;
  if (!proxyMode && basicUser && basicPassword) {
    headers.Authorization = `Basic ${toBase64(`${basicUser}:${basicPassword}`)}`;
  }

  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const timeoutSignal = AbortSignal.timeout(maxTimeout + 15_000);
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: timeoutSignal,
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok === false && !payload.html) {
        throw new Error(payload.error || payload.message || "FlareSolverr a échoué");
      }
      const html = extractHtml(payload, proxyMode);
      if (!html) {
        throw new Error("FlareSolverr n'a pas renvoyé de HTML");
      }
      if (isCloudflareChallengeHtml(html)) {
        throw new Error("FlareSolverr : page Cloudflare encore bloquée");
      }
      return html;
    } catch (error) {
      lastError = error;
      if (attempt < 1) await wait(500);
    }
  }
  throw lastError ?? new Error("FlareSolverr indisponible");
}

export async function tryFlareSolverrHtml(url) {
  const { getFlareSolverrConfig } = await import("./flareSolverrConfig.js");
  const config = getFlareSolverrConfig();
  if (!config?.baseUrl) return null;
  try {
    return await fetchHtmlViaFlareSolverr(url, config);
  } catch {
    return null;
  }
}
