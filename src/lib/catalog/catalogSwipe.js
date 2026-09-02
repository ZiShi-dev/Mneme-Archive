/** Distance horizontale minimale pour changer de page catalogue. */
export const CATALOG_SWIPE_THRESHOLD_PX = 100;

/** Le geste doit être nettement horizontal (évite les dérives pendant le scroll vertical). */
export const CATALOG_SWIPE_DOMINANCE_RATIO = 1.65;

/**
 * Résout un swipe horizontal en action de pagination catalogue.
 * LTR : glisser vers la gauche = page suivante.
 * RTL : glisser vers la droite = page suivante.
 */
export function resolveCatalogSwipeAction(dx, page, dir = "ltr", dy = 0) {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < CATALOG_SWIPE_THRESHOLD_PX) return null;
  if (absY > 8 && absX < absY * CATALOG_SWIPE_DOMINANCE_RATIO) return null;
  const rtl = dir === "rtl";
  const swipeLeft = dx < 0;
  const goNext = rtl ? !swipeLeft : swipeLeft;
  if (goNext) {
    return { page: page + 1, direction: "next" };
  }
  return { page: Math.max(1, page - 1), direction: "prev" };
}
