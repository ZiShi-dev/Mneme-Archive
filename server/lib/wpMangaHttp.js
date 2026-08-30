import { decodeHtml } from "./htmlUtils.js";
import { createCachedHtmlFetcher, fetchProxiedImage } from "./httpUtils.js";
import { isCloudflareChallengeHtml } from "./cloudflareDetect.js";
import { fetchNativeHtml, fetchNativeImage, configureSourceNativeFetch, hasNativeHtmlFetcher } from "./nativeFetchBridge.js";

const WP_MANGA_PAGE_MARKERS = /page-item-detail|c-tabs-item__content|\bitem\b[^"']*\bwp-manga\b|\bwp-manga\b[^"']*\bitem\b|reading-content|wp-manga-chapter|manga-reading|chapter-image|text-chapter/i;

export function defaultWpMangaCatalogHtmlLooksValid(html = "") {
  if (!html || isCloudflareChallengeHtml(html)) return false;
  return /page-item-detail|c-tabs-item__content|\bitem\b[^"']*\bwp-manga\b|\bwp-manga\b[^"']*\bitem\b/i.test(html);
}

export function defaultWpMangaPageHtmlLooksValid(html = "") {
  if (!html || isCloudflareChallengeHtml(html)) return false;
  return WP_MANGA_PAGE_MARKERS.test(html);
}

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
  catalogHtmlLooksValid = defaultWpMangaCatalogHtmlLooksValid,
  preferFlareSolverr = false,
}) {
  function configureNativeFetch(options = {}) {
    configureSourceNativeFetch(options);
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
    preferFlareSolverr,
  });

  async function resolveHtml(url, options = {}) {
    if (preferFlareSolverr) {
      return fetchHtmlRemote(url, options);
    }
    if (!hasNativeHtmlFetcher()) {
      const html = await fetchHtmlRemote(url);
      if (isCloudflareChallengeHtml(html)) {
        throw new Error(forbiddenMessage || `حماية ${sourceName} تمنع الاتصال (Cloudflare)`);
      }
      return html;
    }

    let nativeHtml = "";
    try {
      nativeHtml = await fetchNativeHtml(url, async () => "");
    } catch {
      nativeHtml = "";
    }

    if (catalogHtmlLooksValid(nativeHtml, url)) return nativeHtml;

    try {
      const remote = await fetchHtmlRemote(url);
      if (catalogHtmlLooksValid(remote, url)) return remote;
    } catch {
      // Garde le HTML WebView si le repli HTTP échoue aussi.
    }

    if (isCloudflareChallengeHtml(nativeHtml)) {
      throw new Error(forbiddenMessage || `حماية ${sourceName} تمنع الاتصال (Cloudflare)`);
    }
    if (nativeHtml) return nativeHtml;

    return fetchHtmlRemote(url);
  }

  async function resolveImage(rawUrl, assertImageUrl) {
    const target = assertImageUrl(rawUrl);
    return fetchNativeImage(target, () => fetchProxiedImage(target, `${baseUrl}/`, sourceName));
  }

  return { configureNativeFetch, resolveHtml, resolveImage, fetchHtmlRemote };
}
