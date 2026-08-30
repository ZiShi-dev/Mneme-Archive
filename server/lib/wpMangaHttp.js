import { decodeHtml } from "./htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "./httpUtils.js";

/**
 * Helpers URL partagés pour les thèmes Madara / DooPlay (manga, hentai, etc.).
 */
export function createWpMangaHostHelpers({
  baseUrl,
  apexHostname,
  hostPattern,
  imageHostPattern = null,
}) {
  const imagePattern = imageHostPattern ?? hostPattern;

  function normalizeHost(url) {
    url.hostname = apexHostname;
    return url;
  }

  function normalizeAssetUrl(rawUrl = "", { uploadsOnly = false } = {}) {
    const cleaned = decodeHtml(String(rawUrl)).replace(/\s+/g, "").trim();
    if (!cleaned) return "";
    try {
      const url = new URL(cleaned, baseUrl);
      if (url.protocol !== "https:" || !imagePattern.test(url.hostname)) return "";
      if (uploadsOnly && !url.pathname.startsWith("/wp-content/uploads/")) return "";
      if (hostPattern.test(url.hostname)) return normalizeHost(url).toString();
      return url.toString();
    } catch {
      return "";
    }
  }

  return { normalizeHost, normalizeAssetUrl, baseUrl, apexHostname, hostPattern };
}

/**
 * Fetch HTML/images avec contournement WebView natif optionnel.
 */
export function createWpMangaFetchers({
  baseUrl,
  apexHostname,
  sourceName,
  acceptLanguage = "en,ar;q=0.8",
  timeoutMs,
  forbiddenMessage,
  userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}) {
  let nativeHtmlFetcher = null;
  let nativeImageFetcher = null;

  function configureNativeFetch({ fetchHtml, fetchImage } = {}) {
    nativeHtmlFetcher = fetchHtml ?? null;
    nativeImageFetcher = fetchImage ?? null;
  }

  const fetchHtmlRemote = createCachedHtmlFetcher({
    ttlMs: 5 * 60_000,
    ...(timeoutMs ? { timeoutMs } : {}),
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": acceptLanguage,
      referer: `${baseUrl}/`,
      "user-agent": userAgent,
    },
    getVariants: (url) => {
      try {
        const parsed = new URL(url);
        const alt = new URL(url);
        alt.hostname = parsed.hostname === `www.${apexHostname}` ? apexHostname : `www.${apexHostname}`;
        return alt.toString() === url ? [url] : [url, alt.toString()];
      } catch {
        return [url];
      }
    },
    buildError: (lastStatus) => (lastStatus === 403 && forbiddenMessage
      ? forbiddenMessage
      : `${sourceName} a répondu ${lastStatus || "sans réponse"}`),
  });

  async function resolveHtml(url) {
    if (nativeHtmlFetcher) return nativeHtmlFetcher(url);
    return fetchHtmlRemote(url);
  }

  async function resolveImage(rawUrl, assertImageUrl) {
    const target = assertImageUrl(rawUrl);
    if (nativeImageFetcher) return nativeImageFetcher(target);
    return fetchProxiedImage(target, `${baseUrl}/`, sourceName);
  }

  return { configureNativeFetch, resolveHtml, resolveImage, fetchHtmlRemote };
}
