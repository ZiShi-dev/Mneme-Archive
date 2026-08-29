const CONTAIN_COVER_SOURCES = new Set();

export function usesContainCover(sourceId) {
  return CONTAIN_COVER_SOURCES.has(sourceId);
}

export function usesWideCover(sourceId) {
  return false;
}

export function isStandaloneVideoCatalogItem(item) {
  return item?.catalogStyle === "standalone";
}
