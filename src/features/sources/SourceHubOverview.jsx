import React, { useMemo } from "react";
import { Bookmark, Globe2, Layers3, Zap } from "lucide-react";
import { OverviewPanel } from "../../components/ui/OverviewPanel";
import { useI18n } from "../../i18n/I18nProvider";
import { initialSourcePreferences } from "../../config/sources";
import { SourceLogo } from "./SourceLogo";

export function SourceHubOverview({ sources, sourcePreferences, onAction, actionLabel }) {
  const { t } = useI18n();
  const activeSources = useMemo(
    () => sources.filter((entry) => entry.enabled !== false),
    [sources],
  );
  const activeCount = activeSources.length;
  const totalSelected = useMemo(
    () => Object.values(sourcePreferences).reduce((total, entry) => total + (entry?.selectedItems?.length || 0), 0),
    [sourcePreferences],
  );
  const fullCatalogCount = useMemo(
    () => sources.filter((entry) => {
      const preference = { ...initialSourcePreferences[entry.id], ...sourcePreferences[entry.id] };
      return entry.enabled !== false && preference.mode === "full";
    }).length,
    [sourcePreferences, sources],
  );

  const media = activeSources.length > 0 ? (
    <div className="la-panel__media la-panel__media--logos" aria-label={t("sources.hubActiveCount", { count: activeCount })}>
      {activeSources.slice(0, 4).map((entry) => (
        <SourceLogo key={entry.id} sourceId={entry.id} />
      ))}
      {activeSources.length > 4 && <span className="la-panel__more">+{activeSources.length - 4}</span>}
    </div>
  ) : (
    <div className="la-panel__placeholder" aria-hidden="true">
      <Globe2 size={18} />
    </div>
  );

  const meta = fullCatalogCount > 0
    ? t("sources.hubFull", { count: fullCatalogCount })
      + (activeCount > 0 && activeCount !== fullCatalogCount
        ? t("sources.hubPartial", { count: activeCount - fullCatalogCount })
        : "")
    : undefined;

  return (
    <OverviewPanel
      variant="brand"
      ariaLabel={t("sources.hubAria")}
      eyebrowIcon={Globe2}
      eyebrow={t("sources.hubEyebrow")}
      title={t("sources.hubTitle")}
      description={t("sources.hubDescription")}
      media={media}
      stats={[
        { icon: Layers3, value: sources.length, label: t("sources.hubSource") },
        { icon: Zap, value: activeCount, label: t("sources.hubActive"), tone: "success" },
        { icon: Bookmark, value: totalSelected, label: t("sources.hubPicked"), tone: "accent" },
      ]}
      meta={meta}
      actionLabel={actionLabel}
      onAction={onAction}
      className="settings-page__panel"
    />
  );
}
