import { Bookmark, Compass, Home, Settings2, Sparkles } from "lucide-react";

export function navItems(t) {
  return [
    ["home", Home, t("nav.home"), t("nav.homeAria")],
    ["sources", Compass, t("nav.discover"), t("nav.discoverAria")],
    ["favorites", Bookmark, t("nav.favorites"), t("nav.favoritesAria")],
    ["updates", Sparkles, t("nav.updates"), t("nav.updatesAria")],
    ["settings", Settings2, t("nav.settings"), t("nav.settingsAria")],
  ];
}

export function isNavScreenActive(screenId, current) {
  if (screenId === "sources") {
    return current === "sources" || current === "source-catalog";
  }
  return current === screenId;
}
