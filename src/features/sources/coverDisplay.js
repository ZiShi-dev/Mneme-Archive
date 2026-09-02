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
