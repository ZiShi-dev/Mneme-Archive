import { t } from "../../i18n/runtime.js";
import { getSourceProfile } from "../../config/sources.js";
import { sourceCapability, sourcesWithCapability } from "../../config/sourceCapabilities.js";
import { localizeCatalogKind } from "./contentTypes.js";

const CATALOG_SCOPED_SEARCH_SOURCES = new Set(sourcesWithCapability("catalogScopedSearch"));

export const MULTI_TAXONOMY_SOURCES = new Set(["wiflix", "frenchstream", "coflix"]);

export function supportsMultiTaxonomy(sourceId) {
  return MULTI_TAXONOMY_SOURCES.has(sourceId);
}

export function isSearchQueryActive(query) {
  return String(query || "").trim().length >= 2;
}

const MEDIA_KIND_SLUGS = new Set(["movies", "series", "anime", "manga", "novel"]);

function isMediaKindFilter(filter) {
  if (!filter?.slug || filter.slug === "all") return false;
  return filter.type === "kind" || MEDIA_KIND_SLUGS.has(filter.slug);
}

function isCompoundTaxonomy(selection) {
  return Boolean(selection?.category || selection?.tag || selection?.author);
}

export function normalizeTaxonomySelection(selection) {
  if (!selection) {
    return { category: null, tag: null, author: null };
  }
  if (isCompoundTaxonomy(selection)) {
    return {
      category: selection.category || null,
      tag: selection.tag || null,
      author: selection.author || null,
    };
  }
  if (!selection.type || selection.slug === "all") {
    return { category: null, tag: null, author: null };
  }
  return {
    category: selection.type === "category" ? selection : null,
    tag: selection.type === "tag" ? selection : null,
    author: selection.type === "author" ? selection : null,
  };
}

export function isTaxonomySelectionEmpty(selection) {
  const normalized = normalizeTaxonomySelection(selection);
  return !normalized.category && !normalized.tag && !normalized.author;
}

export function toggleTaxonomySelection(current, type, entry) {
  const normalized = normalizeTaxonomySelection(current);
  const active = normalized[type];
  const nextEntry = active?.slug === entry.slug
    ? null
    : {
      type,
      slug: entry.slug,
      name: entry.name,
      archivePath: entry.archivePath,
      filterPath: entry.filterPath,
      queryParam: entry.queryParam,
      queryValue: entry.queryValue,
      filterQueryValue: entry.filterQueryValue,
    };
  const next = { ...normalized, [type]: nextEntry };
  return isTaxonomySelectionEmpty(next) ? null : next;
}

function taxonomyStorageKey(filter) {
  const normalized = normalizeTaxonomySelection(filter);
  const parts = [];
  if (normalized.category) parts.push(`category:${normalized.category.slug}`);
  if (normalized.tag) parts.push(`tag:${normalized.tag.slug}`);
  if (normalized.author) parts.push(`author:${normalized.author.slug}`);
  if (!parts.length && filter?.slug && filter.slug !== "all") {
    return `${filter.type || "all"}:${filter.slug}`;
  }
  return parts.length ? parts.join("+") : "all";
}

function primaryTaxonomyFilter(filter) {
  const normalized = normalizeTaxonomySelection(filter);
  return normalized.category || normalized.tag || normalized.author || (filter?.slug && filter.slug !== "all" ? filter : null);
}

export function shouldUseCatalogScopedSearch(sourceId, kind, taxonomy, query) {
  if (!isSearchQueryActive(query)) return false;
  const primary = primaryTaxonomyFilter(taxonomy);
  if (isMediaKindFilter(kind) && !primary) return false;
  if (!primary) return false;
  if (sourceCapability(sourceId, "multiTaxonomy") && primary.filterPath) return true;
  return CATALOG_SCOPED_SEARCH_SOURCES.has(sourceId);
}

export function filterCatalogItemsByQuery(items, query) {
  const needle = String(query || "").trim().toLocaleLowerCase("ar");
  if (needle.length < 2) return items;
  return items.filter((item) => (
    `${item.title || ""} ${item.altTitle || ""} ${item.summary || ""}`.toLocaleLowerCase("ar").includes(needle)
  ));
}

export function catalogViewKey(sourceId, filter, query = "", kind = null) {
  const filterKey = taxonomyStorageKey(filter);
  const kindKey = kind?.slug && kind.slug !== "all" ? `:kind:${kind.slug}` : "";
  const normalized = String(query || "").trim().toLocaleLowerCase("ar");
  const queryKey = normalized.length >= 2 ? `:q:${normalized}` : "";
  return `${sourceId}:${filterKey}${kindKey}${queryKey}`;
}

export function resolveEffectiveFilter(kind, taxonomy) {
  const normalized = normalizeTaxonomySelection(taxonomy);
  const hasTaxonomy = normalized.category || normalized.tag || normalized.author;
  if (hasTaxonomy) {
    return {
      ...normalized,
      kindSlug: kind?.slug && kind.slug !== "all" ? kind.slug : "",
      kindFilterPath: kind?.filterPath || "",
    };
  }
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

function resolveActiveKindSlug(filter) {
  if (filter?.kindSlug && filter.kindSlug !== "all") return filter.kindSlug;
  if (filter?.type === "kind" && filter.slug && filter.slug !== "all") return filter.slug;
  return "";
}

function resolveActiveKindPath(filter) {
  return filter?.kindFilterPath
    || (filter?.type === "kind" ? filter.filterPath : "")
    || "";
}

export function categoryMatchesKind(category, kindSlug) {
  if (!category?.filterPath || !kindSlug || kindSlug === "all") return true;
  if (category.mediaKind) return category.mediaKind === kindSlug;
  if (kindSlug === "series") return !/^\/films\//i.test(category.filterPath);
  if (kindSlug === "movies") {
    return /^\/films\//i.test(category.filterPath)
      || !/(?:^|\/)s-tv\/|series/i.test(category.filterPath);
  }
  return true;
}

export function isTaxonomyCompatibleWithKind(taxonomy, kind) {
  const kindSlug = kind?.slug && kind.slug !== "all" ? kind.slug : "";
  if (!kindSlug) return true;
  const normalized = normalizeTaxonomySelection(taxonomy);
  if (normalized.category && !categoryMatchesKind(normalized.category, kindSlug)) return false;
  return true;
}

export function filterCategoriesForKind(categories = [], kind) {
  const kindSlug = kind?.slug && kind.slug !== "all" ? kind.slug : "";
  if (!kindSlug) return categories;
  return categories.filter((entry) => categoryMatchesKind(entry, kindSlug));
}

function resolveTaxonomyQueryValue(entry) {
  return entry?.filterQueryValue || entry?.queryValue || entry?.slug || "";
}

export function filterRequestParams(filter) {
  if (!filter) return {};
  const normalized = normalizeTaxonomySelection(filter);
  const kindSlug = resolveActiveKindSlug(filter);
  const kindPath = resolveActiveKindPath(filter);
  const categoryPath = normalized.category?.filterPath
    && categoryMatchesKind(normalized.category, kindSlug)
    ? normalized.category.filterPath
    : "";
  const filterPath = categoryPath
    || normalized.tag?.filterPath
    || normalized.author?.filterPath
    || kindPath
    || filter.filterPath
    || "";
  const kindType = kindSlug;
  const taxonomyScoped = Boolean(
    categoryPath
    || normalized.tag?.filterPath
    || normalized.author?.filterPath,
  );
  const categoryMatches = normalized.category
    && categoryMatchesKind(normalized.category, kindSlug);
  const genre = categoryPath
    ? normalized.category.slug
    : (categoryMatches
      ? resolveTaxonomyQueryValue(normalized.category)
      : (filter.type === "category" ? resolveTaxonomyQueryValue(filter) : ""));
  const tag = resolveTaxonomyQueryValue(normalized.tag)
    || (filter.type === "tag" ? resolveTaxonomyQueryValue(filter) : "");
  return {
    genre,
    tag,
    tagPath: normalized.tag?.archivePath || filter.archivePath || "",
    filterPath,
    queryParam: taxonomyScoped
      ? (filter.queryParam
        || (normalized.author ? "author" : "")
        || (filter.type === "author" ? "author" : ""))
      : (filter.queryParam
        || (normalized.author ? "author" : "")
        || (filter.type === "author" ? "author" : "")
        || (filter.type === "kind" && filter.queryValue ? "type" : "")
        || (kindType ? "type" : "")),
    queryValue: taxonomyScoped
      ? (filter.queryValue
        || (normalized.author?.name || "")
        || (filter.type === "author" ? filter.name : ""))
      : (filter.queryValue
        || (normalized.author?.name || "")
        || (filter.type === "author" ? filter.name : "")
        || (filter.type === "kind" ? filter.queryValue : "")
        || kindType
        || ""),
  };
}

export function describeCatalogView({ query, filter, kind, page }) {
  const parts = [];
  if (isSearchQueryActive(query)) parts.push(t("sources.view.search", { query: query.trim() }));
  if (kind?.slug && kind.slug !== "all") {
    parts.push(t("sources.view.kind", { name: localizeCatalogKind(kind).name }));
  }
  const normalized = normalizeTaxonomySelection(filter);
  if (normalized.category) parts.push(t("sources.view.genre", { name: normalized.category.name }));
  if (normalized.tag) parts.push(t("sources.view.tag", { name: normalized.tag.name }));
  if (normalized.author) parts.push(t("sources.view.author", { name: normalized.author.name }));
  if (!normalized.category && !normalized.tag && !normalized.author && filter?.slug && filter.slug !== "all") {
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
    if (item.catalogKind) {
      const needle = filter.queryValue || filter.slug;
      return item.catalogKind === needle;
    }
    if (filter.slug === "movies") return item.mediaType === "movie";
    if (filter.slug === "series") return item.mediaType === "series" || item.mediaType === "anime";
    if (filter.slug === "anime") return item.mediaType === "anime";
    if (filter.slug === "manga") return item.mediaType === "manga";
    if (filter.slug === "novel") return item.mediaType === "novel";
    return true;
  }

  if (filter.type === "tag" && /^\d{4}$/.test(String(filter.slug || ""))) {
    const itemYear = String(item.year || item.altTitle || item.title || "").match(/\b(19|20)\d{2}\b/)?.[0];
    return itemYear === String(filter.slug);
  }

  const haystack = [
    ...(Array.isArray(item.categories) ? item.categories : []),
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(item.genres) ? item.genres : []),
    item.mediaTypeLabel || "",
    item.year || "",
    item.altTitle || "",
  ].join(" ").toLocaleLowerCase("ar");

  const slug = String(filter.slug || "").toLocaleLowerCase("ar");
  const name = String(filter.name || "").toLocaleLowerCase("ar");
  if (!haystack.trim()) return true;
  return haystack.includes(name) || haystack.includes(slug);
}

function primaryTaxonomyType(normalized) {
  if (normalized.category) return "category";
  if (normalized.tag) return "tag";
  if (normalized.author) return "author";
  return null;
}

export function applyTaxonomyFilters(items, filter) {
  const normalized = normalizeTaxonomySelection(filter);
  const primaryType = primaryTaxonomyType(normalized);
  let result = items;
  for (const type of ["category", "tag", "author"]) {
    if (!normalized[type] || type === primaryType) continue;
    result = result.filter((item) => catalogItemMatchesFilter(item, { ...normalized[type], type }));
  }
  return result;
}

export function sanitizeCatalogKind(sourceId, kind) {
  if (!kind || kind.slug === "all") return null;
  const profile = getSourceProfile(sourceId);
  const supported = profile?.contentTypes || [];
  if (!supported.length) return null;
  if (kind.type === "kind" && kind.queryValue) return kind;
  if (kind.queryParam) return kind;
  if (supported.length === 1) return null;
  if (!isMediaKindFilter(kind)) return kind;
  if (supported.includes(kind.slug)) return kind;
  if (kind.queryValue && supported.includes(kind.queryValue)) return kind;
  return null;
}
