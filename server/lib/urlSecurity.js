const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::",
  "::1",
  "[::1]",
  "metadata.google.internal",
]);

const METADATA_HOST_PATTERN = /(?:^|\.)metadata\.google\.internal$/i;

function parseIpv4Octets(host = "") {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  const parts = host.split(".").map(Number);
  if (parts.some((part) => part > 255)) return null;
  return parts;
}

function isBlockedIpv4(parts) {
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

function mappedIpv4FromIpv6(host = "") {
  const dotted = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (dotted) return dotted[1];
  const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hex) return null;
  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}

function isBlockedIpv6(host = "") {
  if (host === "::" || host === "::1") return true;
  const mapped = mappedIpv4FromIpv6(host);
  if (mapped) {
    const parts = parseIpv4Octets(mapped);
    return !parts || isBlockedIpv4(parts);
  }
  if (/^(fc|fd)/i.test(host)) return true;
  if (/^fe[89ab]/i.test(host)) return true;
  if (/^ff/i.test(host)) return true;
  return false;
}

export function isBlockedNetworkHost(hostname = "") {
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (METADATA_HOST_PATTERN.test(host)) return true;
  const ipv4 = parseIpv4Octets(host);
  if (ipv4) return isBlockedIpv4(ipv4);
  if (host.includes(":")) return isBlockedIpv6(host);
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
  if (url.username || url.password) throw new Error(`${label} non autorisée`);
  if (isBlockedNetworkHost(url.hostname)) throw new Error(`${label} non autorisée`);
  url.hash = "";
  return url.toString();
}
