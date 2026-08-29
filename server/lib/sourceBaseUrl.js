import { assertPublicHttpsUrl } from "./urlSecurity.js";

function normalizeBaseUrl(baseUrl = "") {
  return String(baseUrl).replace(/\/+$/, "");
}

export function isAllowedSourceBaseHost(hostname = "", defaultBaseUrl = "", { allowedApexHosts = [], allowedHostPattern } = {}) {
  const host = String(hostname || "").toLowerCase();
  if (!host) return false;

  const defaultCtx = createHostContext(normalizeBaseUrl(defaultBaseUrl));
  const candidateCtx = createHostContext(`https://${host}`);

  if (candidateCtx.apex === defaultCtx.apex) return true;

  const allowedApex = allowedApexHosts.map((entry) => String(entry).toLowerCase());
  if (allowedApex.includes(candidateCtx.apex)) return true;

  if (allowedHostPattern?.test(host)) return true;

  return false;
}

export function resolveRequestBaseUrl(requestUrl, defaultBaseUrl, options = {}) {
  const { label = "URL" } = options;
  const raw = requestUrl?.searchParams?.get?.("baseUrl")?.trim();
  if (!raw) return normalizeBaseUrl(defaultBaseUrl);

  const verified = assertPublicHttpsUrl(raw, { label }).replace(/\/+$/, "");
  const hostname = new URL(verified).hostname;

  if (!isAllowedSourceBaseHost(hostname, defaultBaseUrl, options)) {
    throw new Error(`${label} baseUrl non autorisée`);
  }

  return verified;
}

export function createHostContext(baseUrl) {
  const parsed = new URL(baseUrl);
  const hostname = parsed.hostname.toLowerCase();
  const apex = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  const allowedHosts = new Set([hostname, apex, `www.${apex}`]);
  const hostPattern = new RegExp(`(?:^|\\.)${apex.replace(/\./g, "\\.")}$`, "i");
  return { baseUrl, hostname, apex, allowedHosts, hostPattern };
}

export function resolveSourceRequestContext(requestUrl, defaultBaseUrl, options = {}) {
  const baseUrl = resolveRequestBaseUrl(requestUrl, defaultBaseUrl, options);
  return createHostContext(baseUrl);
}
