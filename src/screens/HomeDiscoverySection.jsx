import React, { useEffect, useMemo } from "react";
import { Settings2 } from "lucide-react";
import { SourceScopeBar } from "../components/sources/SourceScopeBar";
import { prefetchCatalog } from "../features/sources/sourceApi";
import { DEFAULT_SOURCE_ID } from "../config/appFlavor";
import { useI18n } from "../i18n/I18nProvider";

export function HomeDiscoverySection({
  sources,
  sourcePreferences,
  activeSourceId,
  onOpenCatalog,
  onManage,
}) {
  const { t } = useI18n();
  const enabledSources = useMemo(
    () => sources.filter((source) => source.enabled !== false),
    [sources],
  );

  const meta = enabledSources.length
    ? t("home.discoveryHint")
    : t("home.noEnabledSources");

  useEffect(() => {
    if (!enabledSources.length) return undefined;
    const sourceId = enabledSources.some((source) => source.id === activeSourceId)
      ? activeSourceId
      : (enabledSources[0]?.id || DEFAULT_SOURCE_ID);
    void prefetchCatalog(sourceId);
    return undefined;
  }, [enabledSources, activeSourceId]);

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
          onPointerDown={() => {
            const sourceId = enabledSources.some((source) => source.id === activeSourceId)
              ? activeSourceId
              : (enabledSources[0]?.id || DEFAULT_SOURCE_ID);
            void prefetchCatalog(sourceId);
          }}
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
