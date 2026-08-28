import React from "react";
import { getSourceLanguageLabels } from "../../config/sources";
import { getLocale, t } from "../../i18n/runtime";

export function SourceLanguageChips({ sourceId, profile, className = "" }) {
  const labels = getSourceLanguageLabels(profile || sourceId);
  if (!labels.length) return null;
  return (
    <span className={`source-language-chips ${className}`.trim()} aria-label={t("language.list", { labels: labels.join(getLocale() === "fr" ? ", " : "، ") })}>
      {labels.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </span>
  );
}
