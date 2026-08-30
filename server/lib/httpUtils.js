import { isCloudflareChallengeHtml } from "./cloudflareDetect.js";
import { tryFlareSolverrHtml } from "./flareSolverr.js";

export const responseCache = new Map();
const MAX_CACHE_ENTRIES = 100;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetries(url, options = {}, retries = 1) {
  const { timeoutMs, signal: userSignal, ...rest } = options;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (userSignal?.aborted) throw userSignal.reason || lastError;
    try {
      const timeoutSignal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
      const signal = userSignal && timeoutSignal
        ? AbortSignal.any([userSignal, timeoutSignal])
        : (timeoutSignal || userSignal);
      return await fetch(url, signal ? { ...rest, signal } : rest);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) throw error;
      await wait(250 * (attempt + 1));
    }
  }
  throw lastError;
}

function touchCacheEntry(key, value) {
  if (responseCache.has(key)) responseCache.delete(key);
  responseCache.set(key, value);
  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey == null) break;
    responseCache.delete(oldestKey);
  }
}

export async function fetchProxiedImage(target, referer, label) {
  const response = await fetch(target, {
    headers: {
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      referer,
      "user-agent": "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
    signal: AbortSignal.timeout(30_000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.startsWith("image/")) throw new Error(`Image ${label} indisponible (${response.status})`);
  return { kind: "image", contentType, buffer: new Uint8Array(await response.arrayBuffer()) };
}

function isCloudflareChallenge(response, html) {
  if (response.status === 403) return true;
  return isCloudflareChallengeHtml(html);
}

export function createCachedHtmlFetcher({ ttlMs, headers, getVariants, buildError, timeoutMs = 25_000, retries = 1 }) {
  return async function fetchHtml(url) {
    const cached = responseCache.get(url);
    if (cached && Date.now() - cached.at < ttlMs) {
      touchCacheEntry(url, cached);
      return cached.html;
    }
    const variants = getVariants(url);
    let lastStatus = 0;
    let lastError;
    let sawCloudflare = false;
    for (const target of variants) {
      try {
        const response = await fetchWithRetries(target, {
          redirect: "follow",
          headers,
          timeoutMs,
        }, retries);
        lastStatus = response.status;
        lastError = undefined;
        const html = await response.text();
        if (isCloudflareChallenge(response, html)) {
          sawCloudflare = true;
          continue;
        }
        if (response.ok) {
          touchCacheEntry(url, { at: Date.now(), html });
          return html;
        }
      } catch (error) {
        lastError = error;
        if (variants.length === 1 && retries < 1) throw error;
      }
    }
    if (sawCloudflare || lastStatus === 403) {
      const flareHtml = await tryFlareSolverrHtml(url);
      if (flareHtml) {
        touchCacheEntry(url, { at: Date.now(), html: flareHtml });
        return flareHtml;
      }
    }
    if (lastError && !lastStatus) throw lastError;
    throw new Error(buildError(lastStatus));
  };
}
