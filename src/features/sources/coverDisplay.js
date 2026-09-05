const PLACEHOLDER_COVER_RE = /\/images\.png(?:$|\?)|Anime4up-Icon/i;

export function usesContainCover(_sourceId) {
  return false;
}

/** Vignettes paysage (16:9) — catalogues vidéo standalone. */
export function usesWideCover(sourceId, catalogStyle) {
  return catalogStyle === "standalone";
}

export function isStandaloneVideoCatalogItem(item) {
  return item?.catalogStyle === "standalone";
}

/** Affiche le CTA lecture quand le catalogue n’a pas d’épisodes listés (films Anime4up, vidéo standalone). */
export function canShowCatalogWatchAction(item, mediaType, recentChapters = []) {
  if (recentChapters?.length) return false;
  if (isStandaloneVideoCatalogItem(item) && item.url) return true;
  if (mediaType === "movie" && item.url) return true;
  return false;
}

/** Films catalogue → fiche détail ; vidéo standalone → lecteur direct. */
export function openCatalogWatch({ item, mediaType, onOpenDetails, onOpenChapter }) {
  if (!item?.url) return;
  if (mediaType === "movie" && !isStandaloneVideoCatalogItem(item)) {
    onOpenDetails(item);
    return;
  }
  onOpenChapter(item, { url: item.url, name: item.title, number: "1" });
}

/** Logos / placeholders site qui ne doivent pas remplacer une vraie jaquette. */
export function isPlaceholderCover(url = "") {
  const value = String(url || "").trim();
  if (!value) return true;
  return PLACEHOLDER_COVER_RE.test(value);
}

/** Passe les jaquettes http / protocol-relative en https pour le proxy d’images. */
export function normalizeRemoteImageUrl(url = "") {
  const value = String(url || "").trim();
  if (!value) return "";
  if (value.startsWith("data:image/")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return value;
}

export function pickBestCover(...candidates) {
  const urls = candidates.map((url) => String(url || "").trim()).filter(Boolean);
  return urls.find((url) => !isPlaceholderCover(url)) || urls[0] || "";
}
