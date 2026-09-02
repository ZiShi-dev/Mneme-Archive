const EMBED_PROXY_SOURCE_IDS = new Set(["wiflix"]);

const WIFLIX_PROXY_EMBED_HOSTS = /(?:^|\.)(?:multiup\.us|flixeo\.xyz|96ar\.com|sandratableother\.com|diananatureforeign\.com)$/i;

export function wiflixEmbedNeedsProxy(embedUrl = "") {
  try {
    return WIFLIX_PROXY_EMBED_HOSTS.test(new URL(embedUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function usesSourceEmbedProxy(sourceId = "", embedUrl = "") {
  if (!EMBED_PROXY_SOURCE_IDS.has(sourceId)) return false;
  if (sourceId === "wiflix") return wiflixEmbedNeedsProxy(embedUrl);
  return true;
}

export function buildSourceEmbedPath(sourceId, embedUrl, referer = "", appendQueryParams = (query) => query) {
  if (!usesSourceEmbedProxy(sourceId, embedUrl) || !embedUrl) return embedUrl;
  const query = new URLSearchParams({ url: embedUrl });
  if (referer) query.set("referer", referer);
  appendQueryParams(query);
  return `/api/sources/${sourceId}/embed?${query}`;
}

export function buildSourceEmbedUrl(sourceId, embedUrl, referer = "", appendQueryParams = (query) => query) {
  const path = buildSourceEmbedPath(sourceId, embedUrl, referer, appendQueryParams);
  if (!path.startsWith("/api/")) return path;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}
