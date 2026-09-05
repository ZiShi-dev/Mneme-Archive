import React from "react";
import { Bell, ChevronLeft, ChevronRight, Download, History, Search } from "lucide-react";
import { useI18n } from "../../i18n/I18nProvider";
import { AppMark } from "../brand/AppMark";
import { AppBrandName } from "../brand/AppBrandName";
import { getAppBrandText } from "../../lib/brand/appBrand";
import { usePersistedState } from "../../hooks/usePersistedState";
import { isNavScreenActive, navItems } from "./bottomNavItems";

export { navItems } from "./bottomNavItems";

export function BottomNav({ current, navigate }) {
  const { t } = useI18n();
  return (
    <nav className="bottom-nav" aria-label={t("nav.aria")}>
      {navItems(t).map(([id, Icon, label, ariaLabel]) => {
        const active = isNavScreenActive(id, current);
        return (
          <button
            className={`bottom-nav__tab${active ? " is-active active" : ""}`}
            key={id}
            type="button"
            aria-label={ariaLabel}
            aria-current={active ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            <span className="bottom-nav__icon-wrap" aria-hidden="true">
              <Icon size={22} strokeWidth={active ? 2.25 : 1.85} />
            </span>
            <span className="bottom-nav__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function DesktopMenuActions({ current, navigate, collapsed, onToggleCollapse, t }) {
  const utilityItems = [
    ["reading-history", History, t("common.readingHistory")],
    ["downloads", Download, t("downloads.title")],
    ["search", Search, t("common.search")],
  ];

  return (
    <div className="game-nav__footer">
      <div className="game-nav__actions">
        {utilityItems.map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            className={`game-nav__action${current === id ? " is-active" : ""}`}
            aria-label={label}
            aria-current={current === id ? "page" : undefined}
            onClick={() => navigate(id)}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            <span className="game-nav__action-label">{label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`game-nav__action game-nav__action--notify${current === "updates" || current === "notification-center" ? " is-active" : ""}`}
          aria-label={t("common.notifications")}
          onClick={() => navigate("updates")}
          title={collapsed ? t("common.notifications") : undefined}
        >
          <Bell size={18} aria-hidden="true" />
          <span className="game-nav__action-label">{t("common.notifications")}</span>
        </button>
      </div>
      <button
        type="button"
        className="game-nav__toggle"
        onClick={onToggleCollapse}
        aria-label={collapsed ? t("nav.expandNav") : t("nav.collapseNav")}
        aria-expanded={!collapsed}
        title={collapsed ? t("nav.expandNav") : t("nav.collapseNav")}
      >
        {collapsed ? (
          <ChevronRight size={18} className="game-nav__toggle-icon" aria-hidden="true" />
        ) : (
          <ChevronLeft size={18} className="game-nav__toggle-icon" aria-hidden="true" />
        )}
        <span className="game-nav__action-label">{collapsed ? t("nav.expandNav") : t("nav.collapseNav")}</span>
      </button>
    </div>
  );
}

export function DesktopMenu({ current, navigate, appearance }) {
  const { t } = useI18n();
  const brand = getAppBrandText(t);
  const [collapsed, setCollapsed] = usePersistedState("cromebook:nav-collapsed", false);

  return (
    <aside className={`game-nav${collapsed ? " game-nav--collapsed" : ""}`}>
      <button
        type="button"
        className="game-nav__brand"
        onClick={() => navigate("home")}
        aria-label={brand.name}
        title={collapsed ? brand.name : undefined}
      >
        <AppMark size={collapsed ? 36 : 40} appearance={appearance} decorative />
        <div className="game-nav__brand-copy">
          <AppBrandName as="strong" variant="nav" lead={brand.nameLead} tail={brand.nameTail}>
            {brand.name}
          </AppBrandName>
          <small>{brand.kicker}</small>
        </div>
      </button>

      <nav className="game-nav__tabs" aria-label={t("nav.aria")}>
        {navItems(t).map(([id, Icon, label, ariaLabel]) => {
          const active = isNavScreenActive(id, current);
          return (
            <button
              key={id}
              type="button"
              className={`game-nav__tab${active ? " is-active" : ""}`}
              aria-label={ariaLabel}
              aria-current={active ? "page" : undefined}
              onClick={() => navigate(id)}
              title={collapsed ? label : undefined}
            >
              <span className="game-nav__tab-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="game-nav__tab-label">{label}</span>
            </button>
          );
        })}
      </nav>

      <DesktopMenuActions
        current={current}
        navigate={navigate}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        t={t}
      />
    </aside>
  );
}
