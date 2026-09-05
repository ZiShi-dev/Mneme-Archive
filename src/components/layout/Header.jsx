import React from "react";
import { ArrowRight, Bell, Download, History, Search } from "lucide-react";
import { isChromebookApp } from "../../config/appFlavor";
import { useI18n } from "../../i18n/I18nProvider";
import { AppBrandName } from "../brand/AppBrandName";
import { MnemeMark } from "../brand/MnemeMark";

function HeaderActions({ onReadingHistory, onDownloads, onSearch, onNotifications, t }) {
  return (
    <div className="header-actions">
      {onReadingHistory && (
        <button className="icon-button" type="button" aria-label={t("common.readingHistory")} onClick={onReadingHistory}>
          <History size={20} />
        </button>
      )}
      {onDownloads && (
        <button className="icon-button" type="button" aria-label={t("downloads.title")} onClick={onDownloads}>
          <Download size={20} />
        </button>
      )}
      <button className="icon-button" type="button" aria-label={t("common.search")} onClick={onSearch}>
        <Search size={20} />
      </button>
      <button className="icon-button has-dot" type="button" aria-label={t("common.notifications")} onClick={onNotifications}>
        <Bell size={20} />
      </button>
    </div>
  );
}

export function Header({
  title,
  titleLead,
  titleTail,
  brandTitle = false,
  eyebrow,
  onBack,
  actions = true,
  onSearch,
  onReadingHistory,
  onDownloads,
  onNotifications,
  showBrand = false,
  appearance,
}) {
  const { t } = useI18n();
  const showMark = showBrand && !isChromebookApp;
  const showActions = actions && !isChromebookApp;
  const titleNode = brandTitle && titleLead && titleTail ? (
    <AppBrandName as="h1" variant="header" lead={titleLead} tail={titleTail} />
  ) : (
    <h1>{title}</h1>
  );

  if (showMark) {
    return (
      <header className="page-header page-header--brand">
        <div className="page-header__brand-top">
          <MnemeMark
            size={36}
            appearance={appearance}
            className="page-header__mark"
            decorative
          />
          {showActions && (
            <HeaderActions
              onReadingHistory={onReadingHistory}
              onDownloads={onDownloads}
              onSearch={onSearch}
              onNotifications={onNotifications}
              t={t}
            />
          )}
        </div>
        <div className="page-header__copy">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          {titleNode}
        </div>
      </header>
    );
  }

  return (
    <header className="page-header">
      <div className="page-header__title">
        {onBack && <button className="icon-button" onClick={onBack} aria-label={t("common.back")}><ArrowRight size={20} /></button>}
        <div className="page-header__copy">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
        </div>
      </div>
      {showActions && (
        <HeaderActions
          onReadingHistory={onReadingHistory}
          onDownloads={onDownloads}
          onSearch={onSearch}
          onNotifications={onNotifications}
          t={t}
        />
      )}
    </header>
  );
}
