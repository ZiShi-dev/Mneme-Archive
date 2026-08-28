import React from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = "brand",
  className = "",
}) {
  return (
    <div className={`la-empty${variant === "accent" ? " la-empty--accent" : ""} ${className}`.trim()}>
      {Icon && <Icon size={32} aria-hidden="true" />}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
