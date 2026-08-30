export function usesContainCover(_sourceId) {
  return false;
}

export function usesWideCover(_sourceId) {
  return false;
}

export function isStandaloneVideoCatalogItem(item) {
  return item?.catalogStyle === "standalone";
}
