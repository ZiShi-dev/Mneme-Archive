import { t } from "../../i18n/runtime.js";

export function isSearchQueryActive(query) {
  return String(query || "").trim().length >= 2;
}

const MEDIA_KIND_SLUGS = new Set(["movies", "series", "anime", "manga", "novel"]);

function isMediaKindFilter(filter) {
  if (!filter?.slug || filter.slug === "all") return false;
  return filter.type === "kind" || MEDIA_KIND_SLUGS.has(filter.slug);
}

export function shouldUseCatalogScopedSearch(sourceId, kind, taxonomy, query) {
  if (!isSearchQueryActive(query)) return false;
  if (isMediaKindFilter(kind) && (!taxonomy?.slug || taxonomy.slug === "all")) return false;
  if (!taxonomy?.slug || taxonomy.slug === "all") return false;
  return [
    "mangalik",
    "mangaforfree",
    "dilar",
    "arabshentai",
    "hentairead",
    "hentaigasm",
    "azorafly",
    "anime4up",
    "cenele",
    "galaxynovels",
    "novelsparadise",
    "kolnovel",
    "nightnovel",
    "realmnovel",
  ].includes(sourceId);
}

export function filterCatalogItemsByQuery(items, query) {
  const needle = String(query || "").trim().toLocaleLowerCase("ar");
  if (needle.length < 2) return items;
  return items.filter((item) => (
    `${item.title || ""} ${item.altTitle || ""} ${item.summary || ""}`.toLocaleLowerCase("ar").includes(needle)
  ));
}

export function catalogViewKey(sourceId, filter, query = "", kind = null) {
  const filterKey = filter?.slug ? `${filter.type || "all"}:${filter.slug}` : "all";
  const kindKey = kind?.slug && kind.slug !== "all" ? `:kind:${kind.slug}` : "";
  const normalized = String(query || "").trim().toLocaleLowerCase("ar");
  const queryKey = normalized.length >= 2 ? `:q:${normalized}` : "";
  return `${sourceId}:${filterKey}${kindKey}${queryKey}`;
}

export function resolveEffectiveFilter(kind, taxonomy) {
  if (taxonomy) {
    return {
      ...taxonomy,
      kindSlug: kind?.slug && kind.slug !== "all" ? kind.slug : "",
      kindFilterPath: kind?.filterPath || "",
    };
  }
  if (kind?.slug && kind.slug !== "all") return kind;
  return null;
}

export function filterRequestParams(filter) {
  if (!filter) return {};
  const filterPath = filter.filterPath || filter.kindFilterPath || "";
  const kindType = filter.kindSlug && filter.kindSlug !== "all" ? filter.kindSlug : "";
  return {
    genre: filter.type === "category" ? filter.slug : "",
    tag: filter.type === "tag" ? filter.slug : "",
    tagPath: filter.archivePath || "",
    filterPath,
    queryParam: filter.queryParam
      || (filter.type === "author" ? "author" : "")
      || (filter.type === "kind" && filter.queryValue ? "type" : "")
      || (kindType ? "type" : ""),
    queryValue: filter.queryValue
      || (filter.type === "author" ? filter.name : "")
      || (filter.type === "kind" ? filter.queryValue : "")
      || kindType
      || "",
  };
}

export function describeCatalogView({ query, filter, kind, page }) {
  const parts = [];
  if (isSearchQueryActive(query)) parts.push(t("sources.view.search", { query: query.trim() }));
  if (kind?.slug && kind.slug !== "all") parts.push(t("sources.view.kind", { name: kind.name }));
  if (filter && filter.slug !== "all") {
    const key = filter.type === "tag"
      ? "sources.view.tag"
      : filter.type === "author"
        ? "sources.view.author"
        : "sources.view.genre";
    parts.push(t(key, { name: filter.name }));
  }
  if (!parts.length) parts.push(t("sources.view.page", { page }));
  return parts.join(" · ");
}

export function catalogItemMatchesFilter(item, filter) {
  if (!filter || filter.slug === "all") return true;
  if (filter.filterPath === "/all/" && !isMediaKindFilter(filter)) return true;

  if (isMediaKindFilter(filter)) {
    if (filter.slug === "movies") return item.mediaType === "movie";
    if (filter.slug === "series") return item.mediaType === "series" || item.mediaType === "anime";
    if (filter.slug === "anime") return item.mediaType === "anime";
    if (filter.slug === "manga") return item.mediaType === "manga";
    if (filter.slug === "novel") return item.mediaType === "novel";
    return true;
  }

  const haystack = [
    ...(Array.isArray(item.categories) ? item.categories : []),
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(item.genres) ? item.genres : []),
    item.mediaTypeLabel || "",
  ].join(" ").toLocaleLowerCase("ar");

  const slug = String(filter.slug || "").toLocaleLowerCase("ar");
  const name = String(filter.name || "").toLocaleLowerCase("ar");
  if (!haystack.trim()) return true;
  return haystack.includes(name) || haystack.includes(slug);
}
