import React from "react";
import { Bookmark, Compass, Home, Settings2, Sparkles } from "lucide-react";
import { useI18n } from "../../i18n/I18nProvider";

export function BottomNav({ current, navigate }) {
  const { t } = useI18n();
  const items = [
    ["home", Home, t("nav.home"), t("nav.homeAria")],
    ["sources", Compass, t("nav.discover"), t("nav.discoverAria")],
    ["favorites", Bookmark, t("nav.favorites"), t("nav.favoritesAria")],
    ["updates", Sparkles, t("nav.updates"), t("nav.updatesAria")],
    ["settings", Settings2, t("nav.settings"), t("nav.settingsAria")],
  ];
  return (
    <nav className="bottom-nav" aria-label={t("nav.aria")}>
      {items.map(([id, Icon, label, ariaLabel]) => (
        <button
          className={current === id ? "active" : ""}
          key={id}
          type="button"
          aria-label={ariaLabel}
          aria-current={current === id ? "page" : undefined}
          onClick={() => navigate(id)}
        >
          <Icon size={21} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
