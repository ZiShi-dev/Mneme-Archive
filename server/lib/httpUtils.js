import { publicFetch } from "./publicFetch.js";
import { isCloudflareChallengeHtml } from "./cloudflareDetect.js";
import { requireFlareSolverrHtml, tryFlareSolverrHtml } from "./flareSolverr.js";

export const responseCache = new Map();
const MAX_CACHE_ENTRIES = 100;
const htmlInFlight = new Map();

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
      return await publicFetch(url, signal ? { ...rest, signal } : rest);
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
  const response = await publicFetch(target, {
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

export function createCachedHtmlFetcher({
  ttlMs,
  headers,
  getVariants,
  buildError,
  timeoutMs = 25_000,
  retries = 1,
  preferFlareSolverr = false,
  skipFlareSolverrFallback = false,
}) {
  return async function fetchHtml(url, options = {}) {
    const includeAssets = Boolean(options.includeAssets);
    const cacheKey = includeAssets ? `${url}#flare-assets` : url;
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.at < ttlMs) {
      touchCacheEntry(cacheKey, cached);
      return cached.html;
    }
    const inflight = htmlInFlight.get(cacheKey);
    if (inflight) return inflight;

    const pending = (async () => {
    const variants = typeof getVariants === "function" ? getVariants(url) : [url];
    // Respecter l’ordre de getVariants (miroirs prioritaires) plutôt que forcer l’URL d’origine en tête.
    const targets = [...new Set((variants?.length ? variants : [url]))];

    if (preferFlareSolverr) {
      let flareError;
      try {
        const flareHtml = await requireFlareSolverrHtml(url, { includeAssets });
        touchCacheEntry(cacheKey, { at: Date.now(), html: flareHtml });
        return flareHtml;
      } catch (error) {
        flareError = error;
      }
      // Flare HS : tenter les miroirs en HTTP direct (ex. manhwaread.org sans CF).
      let lastStatus = 0;
      let lastError = flareError;
      for (const target of targets) {
        try {
          const response = await fetchWithRetries(target, {
            redirect: "follow",
            headers,
            timeoutMs,
          }, retries);
          lastStatus = response.status;
          const html = await response.text();
          if (isCloudflareChallenge(response, html)) continue;
          if (response.ok) {
            touchCacheEntry(cacheKey, { at: Date.now(), html });
            return html;
          }
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError ?? new Error(buildError(lastStatus));
    }

    let lastStatus = 0;
    let lastError;
    let sawCloudflare = false;
    for (const target of targets) {
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
          touchCacheEntry(cacheKey, { at: Date.now(), html });
          return html;
        }
      } catch (error) {
        lastError = error;
        if (targets.length === 1 && retries < 1) throw error;
      }
    }
    if (!skipFlareSolverrFallback && (sawCloudflare || lastStatus === 403)) {
      const flareHtml = await tryFlareSolverrHtml(url);
      if (flareHtml) {
        touchCacheEntry(cacheKey, { at: Date.now(), html: flareHtml });
        return flareHtml;
      }
    }
    if (lastError && !lastStatus) throw lastError;
    throw new Error(buildError(lastStatus));
    })();

    htmlInFlight.set(cacheKey, pending);
    try {
      return await pending;
    } finally {
      htmlInFlight.delete(cacheKey);
    }
  };
}
