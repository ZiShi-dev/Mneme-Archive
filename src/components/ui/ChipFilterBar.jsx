import React from "react";
import { X } from "lucide-react";
import { t } from "../../i18n/runtime";

export function ChipFilterBar({
  label,
  children,
  className = "",
  role,
  ariaLabel,
  variant,
  loading,
  onClear,
  showClear,
}) {
  return (
    <div
      className={`la-chip-bar${variant === "segmented" ? " la-chip-bar--segmented" : ""}${loading ? " la-chip-bar--loading" : ""} ${className}`.trim()}
      role={role}
      aria-label={ariaLabel}
    >
      {label && <span className="la-chip-bar__label">{label}</span>}
      <div className="la-chip-bar__chips">
        {loading ? (
          <>
            <span />
            <span />
          </>
        ) : (
          children
        )}
      </div>
      {showClear && onClear && (
        <button type="button" className="la-chip-bar__clear" onClick={onClear} aria-label={t("common.clearFilter")}>
          <X size={11} />
        </button>
      )}
    </div>
  );
}

export function ChipFilterButton({
  active,
  disabled,
  onClick,
  children,
  count,
  icon: Icon,
  bordered,
  type = "button",
  ariaPressed,
  role,
  ariaSelected,
}) {
  return (
    <button
      type={type}
      role={role}
      className={`la-chip${active ? " active" : ""}${bordered ? " la-chip--bordered" : ""}`}
      disabled={disabled}
      aria-pressed={ariaPressed ?? (role === "tab" ? undefined : active)}
      aria-selected={ariaSelected ?? (role === "tab" ? active : undefined)}
      onClick={onClick}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      {typeof children === "string" || typeof children === "number" ? <span>{children}</span> : children}
      {count !== undefined && <small>{count}</small>}
    </button>
  );
}
