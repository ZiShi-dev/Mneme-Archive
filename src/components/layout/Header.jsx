import React from "react";
import { ArrowRight, Bell, History, Search } from "lucide-react";
import { isChromebookApp } from "../../config/appFlavor";
import { useI18n } from "../../i18n/I18nProvider";
import { MnemeMark } from "../brand/MnemeMark";

export function Header({
  title,
  eyebrow,
  onBack,
  actions = true,
  onSearch,
  onReadingHistory,
  onNotifications,
  showBrand = false,
  appearance,
}) {
  const { t } = useI18n();
  const showMark = showBrand && !isChromebookApp;
  const showActions = actions && !isChromebookApp;
  return (
    <header className="page-header">
      <div className="page-header__title">
        {onBack && <button className="icon-button" onClick={onBack} aria-label={t("common.back")}><ArrowRight size={20} /></button>}
        {showMark && (
          <MnemeMark
            size={36}
            appearance={appearance}
            className="page-header__mark"
            decorative
          />
        )}
        <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1></div>
      </div>
      {showActions && (
        <div className="header-actions">
          {onReadingHistory && (
            <button className="icon-button" type="button" aria-label={t("common.readingHistory")} onClick={onReadingHistory}>
              <History size={20} />
            </button>
          )}
          <button className="icon-button" type="button" aria-label={t("common.search")} onClick={onSearch}>
            <Search size={20} />
          </button>
          <button className="icon-button has-dot" type="button" aria-label={t("common.notifications")} onClick={onNotifications}>
            <Bell size={20} />
          </button>
        </div>
      )}
    </header>
  );
}
