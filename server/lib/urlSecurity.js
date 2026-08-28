const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
]);

const PRIVATE_IPV4_PATTERN = /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.)/;
const METADATA_HOST_PATTERN = /(?:^|\.)metadata\.google\.internal$/i;

export function isBlockedNetworkHost(hostname = "") {
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (METADATA_HOST_PATTERN.test(host)) return true;
  if (PRIVATE_IPV4_PATTERN.test(host)) return true;
  if (host.includes(":") && /^(fc|fd|fe80)/i.test(host)) return true;
  return false;
}

export function assertPublicHttpsUrl(rawUrl = "", { label = "URL" } = {}) {
  const decoded = String(rawUrl || "").trim();
  if (!decoded) throw new Error(`${label} invalide`);
  let url;
  try {
    url = new URL(decoded);
  } catch {
    throw new Error(`${label} invalide`);
  }
  if (url.protocol !== "https:") throw new Error(`${label} doit utiliser HTTPS`);
  if (isBlockedNetworkHost(url.hostname)) throw new Error(`${label} non autorisée`);
  url.hash = "";
  return url.toString();
}
