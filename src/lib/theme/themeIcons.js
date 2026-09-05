import { normalizeThemeId, THEME_INK } from "./appearance.js";

function upsertLink(rel, href, type = "image/png") {
  const selector = rel === "icon"
    ? 'link[rel="icon"]'
    : `link[rel="${rel}"]`;
  let link = document.querySelector(selector);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.type = type;
  link.href = href;
}

export function themeIconBasePath(themeId) {
  return `./pwa/themes/${normalizeThemeId(themeId)}`;
}

export function applyThemeIcons(themeId) {
  if (typeof document === "undefined") return;
  const id = normalizeThemeId(themeId);
  const base = themeIconBasePath(id);
  const version = `?v=${id}`;
  upsertLink("icon", `${base}/favicon.png${version}`);
  upsertLink("apple-touch-icon", `${base}/apple-touch-icon.png${version}`);
}

export function bootIconHref(themeId = THEME_INK) {
  return `${themeIconBasePath(themeId)}/apple-touch-icon.png`;
}
