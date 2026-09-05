import {
  MAX_CHAPTER_KEY_LENGTH,
  MAX_KV_KEY_LENGTH,
  MAX_KV_VALUE_BYTES,
  STORAGE_META_CHAPTER_LOG_BACKFILL,
  STORAGE_META_MIGRATED,
} from "./constants.js";

const EXACT_KEYS = new Set([
  "mangashelf:favorites",
  "living-archive:live-favorites",
  "mangashelf:v4:sources",
  "living-archive:active-source",
  "living-archive:v5:source-preferences",
  "living-archive:ink-mode",
  "living-archive:appearance",
  "living-archive:typeface",
  "living-archive:reading-history",
  "living-archive:chapter-read-log",
  "mangashelf:reader-progress",
  "mangashelf:settings",
  "living-archive:reader-preferences",
  "living-archive:follow-preferences",
  "living-archive:follow-snapshots",
  "living-archive:updates-feed",
  "living-archive:updates-last-sync",
  "living-archive:home-chapter-first-seen",
  "living-archive:catalog-state",
  "living-archive:catalog-snapshots",
  "living-archive:offline-downloads",
  "living-archive:reader-preferences",
  "cromebook:nav-collapsed",
  "cromebook:locale",
  "living-archive:locale",
  "living-archive:onboarding-complete",
  "cinevault:pwa-install-dismissed",
  STORAGE_META_MIGRATED,
  STORAGE_META_CHAPTER_LOG_BACKFILL,
]);

const PREFIX_KEYS = ["living-archive:chapter-progress:"];

export function isAllowedStorageKey(key) {
  if (typeof key !== "string" || !key.trim()) return false;
  if (key.length > MAX_KV_KEY_LENGTH && !key.startsWith("living-archive:chapter-progress:")) return false;
  if (key.startsWith("living-archive:chapter-progress:") && key.length > MAX_CHAPTER_KEY_LENGTH) return false;
  if (EXACT_KEYS.has(key)) return true;
  return PREFIX_KEYS.some((prefix) => key.startsWith(prefix));
}

export function assertAllowedKey(key) {
  if (!isAllowedStorageKey(key)) {
    throw new Error("Clé de stockage non autorisée");
  }
}

export function safeJsonStringify(value) {
  const serialized = JSON.stringify(value);
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > MAX_KV_VALUE_BYTES) {
    throw new Error("Valeur trop volumineuse pour le stockage");
  }
  return serialized;
}

export function safeJsonParse(raw, fallback) {
  if (raw == null || raw === "") return fallback;
  try {
    const parsed = JSON.parse(raw);
    const bytes = new TextEncoder().encode(raw).byteLength;
    if (bytes > MAX_KV_VALUE_BYTES) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isBlockedNetworkHost(hostname = "") {
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) return true;
  return false;
}

export function isAllowedImageUrl(url) {
  if (!isHttpsUrl(url)) return false;
  if (url.length > 2048) return false;
  try {
    return !isBlockedNetworkHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

export async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function extensionForContentType(contentType) {
  const normalized = (contentType || "").split(";")[0].trim().toLowerCase();
  if (normalized === "image/png") return ".png";
  if (normalized === "image/webp") return ".webp";
  if (normalized === "image/gif") return ".gif";
  if (normalized === "image/avif") return ".avif";
  return ".jpg";
}
