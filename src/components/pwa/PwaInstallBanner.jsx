import React from "react";
import { Download, X } from "lucide-react";
import { useI18n } from "../../i18n/I18nProvider";

export function PwaInstallBanner({ canInstall, installed, dismissed, onInstall, onDismiss }) {
  const { t } = useI18n();

  if (!canInstall || installed || dismissed) return null;

  return (
    <section className="pwa-install-banner" aria-label={t("pwa.installTitle")}>
      <div className="pwa-install-banner__copy">
        <strong>{t("pwa.installTitle")}</strong>
        <span>{t("pwa.installHint")}</span>
      </div>
      <div className="pwa-install-banner__actions">
        <button type="button" className="button button--primary pwa-install-banner__install" onClick={onInstall}>
          <Download size={16} aria-hidden="true" />
          {t("pwa.installAction")}
        </button>
        <button type="button" className="pwa-install-banner__dismiss" onClick={onDismiss} aria-label={t("common.close")}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
