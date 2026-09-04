const HTML_CACHE_TTL_MS = 10 * 60_000;
const htmlMemoryCache = new Map();
const htmlInFlight = new Map();

function stripTrailingSlash(pathname = "") {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/**
 * Réduit les doublons WebView (filtres + catalogue page 1, variantes d’URL).
 */
export function normalizeNativeHtmlUrl(url = "") {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === "azorafly.com" || host === "www.azorafly.com") {
      if (stripTrailingSlash(parsed.pathname) === "/series") {
        const page = parsed.searchParams.get("page");
        const hasQuery = parsed.searchParams.has("genres") || parsed.searchParams.has("searchTerm");
        if (!hasQuery && (!page || page === "1")) {
          parsed.pathname = "/series/";
          parsed.search = "page=1";
          parsed.hash = "";
          return parsed.toString();
        }
      }
    }

    if (host === "mangalik.net" || host === "www.mangalik.net") {
      const pathParts = stripTrailingSlash(parsed.pathname).split("/").filter(Boolean);
      if (pathParts[0] === "manga" && pathParts.length === 1) {
        parsed.search = "";
        parsed.hash = "";
        return `${parsed.origin}/manga/`;
      }
      if (pathParts[0] === "manga" && pathParts.length === 2) {
        parsed.search = "";
        parsed.hash = "";
        return `${parsed.origin}/manga/${pathParts[1]}/`;
      }
      if (pathParts[0] === "manga" && pathParts.length >= 3) {
        parsed.searchParams.set("style", "list");
        parsed.hash = "";
        return parsed.toString();
      }
      if (pathParts.length >= 3 && pathParts[pathParts.length - 1] === "chapters" && pathParts[pathParts.length - 2] === "ajax") {
        parsed.search = "";
        parsed.hash = "";
        return `${parsed.origin}/${pathParts.join("/")}/`;
      }
    }

    if (host === "galaxynovels.com" || host === "www.galaxynovels.com") {
      const path = stripTrailingSlash(parsed.pathname);
      if (path === "/library") {
        const page = parsed.searchParams.get("library_page");
        if (!page || page === "1") {
          parsed.search = "";
          parsed.hash = "";
          return `${parsed.origin}/library/`;
        }
      }
    }

    if (host === "kolnovel.com" || host === "www.kolnovel.com") {
      const path = stripTrailingSlash(parsed.pathname);
      if (path === "/series") {
        const page = parsed.searchParams.get("page") || "1";
        const hasFilters = parsed.searchParams.has("s")
          || [...parsed.searchParams.keys()].some((key) => key.startsWith("genre") || key.startsWith("type"));
        if (page === "1" && !hasFilters) {
          parsed.search = "";
          parsed.hash = "";
          return `${parsed.origin}/series/`;
        }
      }
    }

    if (host === "novelphoenix.com" || host === "www.novelphoenix.com") {
      const path = stripTrailingSlash(parsed.pathname);
      if (!path || path === "/genre-all/sort-new/status-all/all-novel") {
        const page = parsed.searchParams.get("page") || "1";
        if (page === "1") {
          parsed.pathname = "/genre-all/sort-new/status-all/all-novel";
          parsed.search = "";
          parsed.hash = "";
          return `${parsed.origin}${parsed.pathname}`;
        }
      }
    }

    if (host === "novelsparadise.site" || host === "www.novelsparadise.site") {
      const path = stripTrailingSlash(parsed.pathname);
      if (path === "/series") {
        const page = parsed.searchParams.get("page") || "1";
        const order = parsed.searchParams.get("order") || "latest";
        const status = parsed.searchParams.get("status") || "";
        const hasFilters = parsed.searchParams.has("s")
          || [...parsed.searchParams.keys()].some((key) => key.startsWith("genre") || key.startsWith("type"));
        if (page === "1" && order === "latest" && !status && !hasFilters) {
          parsed.search = "";
          parsed.hash = "";
          return `${parsed.origin}/series/`;
        }
      }
    }
  } catch {
    return url;
  }
  return url;
}

function readCachedHtml(url) {
  const entry = htmlMemoryCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.at > HTML_CACHE_TTL_MS) {
    htmlMemoryCache.delete(url);
    return null;
  }
  return entry.html;
}

function writeCachedHtml(url, html) {
  if (!url || !html) return;
  htmlMemoryCache.set(url, { html, at: Date.now() });
}

export function clearNativeHtmlCache() {
  htmlMemoryCache.clear();
  htmlInFlight.clear();
}

export function invalidateNativeHtmlCache(url = "") {
  const normalizedUrl = normalizeNativeHtmlUrl(url);
  htmlMemoryCache.delete(normalizedUrl);
  htmlInFlight.delete(normalizedUrl);
}

export async function fetchNativeHtmlWithCache(fetcher, url) {
  const normalizedUrl = normalizeNativeHtmlUrl(url);
  const cached = readCachedHtml(normalizedUrl);
  if (cached) return cached;

  if (htmlInFlight.has(normalizedUrl)) {
    return htmlInFlight.get(normalizedUrl);
  }

  const pending = fetcher(normalizedUrl)
    .then((html) => {
      writeCachedHtml(normalizedUrl, html);
      return html;
    })
    .finally(() => {
      htmlInFlight.delete(normalizedUrl);
    });
  htmlInFlight.set(normalizedUrl, pending);
  return pending;
}
