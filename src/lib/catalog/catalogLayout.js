import { isChromebookApp } from "../../config/appFlavor.js";

const MOBILE_GRID_COLUMNS = 3;
const DESKTOP_TILE_MIN_PX = 155;
const DESKTOP_GRID_GAP_PX = 16;
const DESKTOP_CONTENT_PADDING_PX = 72;
const DESKTOP_SKELETON_ROWS = 4;

export function isDesktopCatalog() {
  if (typeof document !== "undefined") {
    return document.documentElement.classList.contains("desktop-app");
  }
  return isChromebookApp;
}

export function getCatalogServerPageSpan() {
  return isDesktopCatalog() ? 2 : 1;
}

export function uiPageToServerStartPage(uiPage, pageSpan = getCatalogServerPageSpan()) {
  const safePage = Math.max(1, Number(uiPage) || 1);
  return (safePage - 1) * pageSpan + 1;
}

export function estimateCatalogGridColumns(viewportWidth = 0) {
  if (!isDesktopCatalog()) return MOBILE_GRID_COLUMNS;
  const width = viewportWidth || (typeof window !== "undefined" ? window.innerWidth : 1280);
  const contentWidth = Math.max(320, width - DESKTOP_CONTENT_PADDING_PX);
  return Math.max(4, Math.floor((contentWidth + DESKTOP_GRID_GAP_PX) / (DESKTOP_TILE_MIN_PX + DESKTOP_GRID_GAP_PX)));
}

export function getCatalogSkeletonCount(viewportWidth = 0) {
  if (!isDesktopCatalog()) return MOBILE_GRID_COLUMNS * 3;
  return estimateCatalogGridColumns(viewportWidth) * DESKTOP_SKELETON_ROWS;
}
