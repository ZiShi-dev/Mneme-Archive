/**
 * Système catalogue vidéo partagé (French Stream, Wiflix).
 * Point unique pour les capacités multi-taxonomie, audio VF/VOSTFR et chemins catalogue.
 */
import { defaultVideoKinds } from "../../config/sources.js";
import { sourceCapability } from "../../config/sourceCapabilities.js";

export const VIDEO_CATALOG_SOURCES = Object.freeze(["wiflix", "frenchstream"]);
export const VIDEO_CATALOG_SOURCE_SET = new Set(VIDEO_CATALOG_SOURCES);
const VIDEO_DETAILS_FULL_LIST_SOURCES = new Set(["wiflix", "frenchstream", "anime4up", "animedar"]);
const VIDEO_DETAILS_FULL_LIST_TYPES = new Set(["series", "anime"]);

/** @deprecated Préférer VIDEO_CATALOG_SOURCE_SET */
export const MULTI_TAXONOMY_SOURCES = VIDEO_CATALOG_SOURCE_SET;

export function isVideoCatalogSource(sourceId = "") {
  return VIDEO_CATALOG_SOURCE_SET.has(sourceId);
}

export function supportsVideoCatalogMultiTaxonomy(sourceId = "") {
  return sourceCapability(sourceId, "multiTaxonomy");
}

/** @deprecated Préférer supportsVideoCatalogMultiTaxonomy */
export function supportsMultiTaxonomy(sourceId = "") {
  return supportsVideoCatalogMultiTaxonomy(sourceId);
}

export function getVideoCatalogKinds(sourceId = "") {
  return defaultVideoKinds(sourceId);
}

export function resolveVideoCatalogFilterPath(sourceId = "", kindSlug = "all") {
  const kinds = getVideoCatalogKinds(sourceId);
  if (!kinds.length) return "";
  if (!kindSlug || kindSlug === "all") {
    return kinds.find((entry) => entry.slug === "all")?.filterPath || "";
  }
  return kinds.find((entry) => entry.slug === kindSlug)?.filterPath || "";
}

/** Liste complète des épisodes sur la fiche série / animé. */
export function resolveVideoDetailsChapterPageSize(sourceId = "", mediaType = "", fallback = 20) {
  if (VIDEO_DETAILS_FULL_LIST_TYPES.has(mediaType) && VIDEO_DETAILS_FULL_LIST_SOURCES.has(sourceId)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return fallback;
}
