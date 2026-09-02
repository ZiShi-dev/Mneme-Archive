import React from "react";
import { ChevronDown, Server } from "lucide-react";
import { useI18n } from "../../../i18n/I18nProvider";

export function VideoServerPickerButton({
  label,
  onClick,
  className = "",
  compact = false,
}) {
  const { t } = useI18n();
  const resolvedLabel = label || t("reader.stream.server");

  return (
    <button
      type="button"
      className={`video-server-picker${compact ? " video-server-picker--compact" : ""}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      aria-label={t("reader.stream.openServers", { server: resolvedLabel })}
      aria-haspopup="dialog"
    >
      <Server size={compact ? 15 : 16} aria-hidden="true" />
      <span className="video-server-picker__label" dir="ltr">{resolvedLabel}</span>
      <ChevronDown size={14} className="video-server-picker__chevron" aria-hidden="true" />
    </button>
  );
}
