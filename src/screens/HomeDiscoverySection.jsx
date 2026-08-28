import React, { useMemo } from "react";
import { Settings2 } from "lucide-react";
import { SourceScopeBar } from "../components/sources/SourceScopeBar";
import { useI18n } from "../i18n/I18nProvider";

export function HomeDiscoverySection({
  sources,
  sourcePreferences,
  onOpenCatalog,
  onManage,
}) {
  const { t } = useI18n();
  const enabledSources = useMemo(
    () => sources.filter((source) => source.enabled !== false),
    [sources],
  );

  const meta = enabledSources.length
    ? t("home.activeSources", { count: enabledSources.length })
    : t("home.noEnabledSources");

  return (
    <section className="home-discovery" aria-label={t("home.discoveryAria")}>
      <header className="home-discovery__head">
        <div className="home-discovery__intro">
          <h2>{t("home.discovery")}</h2>
          <p>{meta}</p>
        </div>
        <button type="button" className="home-discovery__manage" onClick={onManage} aria-label={t("home.manageSources")}>
          <Settings2 size={14} />
        </button>
      </header>

      {enabledSources.length > 0 ? (
        <SourceScopeBar
          className="home-discovery__scope"
          sources={enabledSources}
          sourcePreferences={sourcePreferences}
          onClick={onOpenCatalog}
          ariaLabel={t("home.openEnabledCatalog")}
        />
      ) : (
        <div className="home-discovery__empty">
          <p>{t("home.enableToDiscover")}</p>
        </div>
      )}
    </section>
  );
}
