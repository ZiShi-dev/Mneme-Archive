import React from "react";
import { X } from "lucide-react";
import { t } from "../../i18n/runtime";

export function SheetCloseButton({
  onClick,
  label = t("common.close"),
  size = 15,
  className = "",
}) {
  return (
    <button
      type="button"
      className={`sheet-close${className ? ` ${className}` : ""}`}
      onClick={onClick}
      aria-label={label}
    >
      <X size={size} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
