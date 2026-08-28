import React from "react";
import { ChevronLeft } from "lucide-react";

export function OverviewPanel({
  variant = "brand",
  ariaLabel,
  eyebrowIcon: EyebrowIcon,
  eyebrow,
  title,
  description,
  media,
  stats = [],
  meta,
  actionLabel,
  onAction,
  className = "",
}) {
  return (
    <section className={`la-panel la-panel--${variant} ${className}`.trim()} aria-label={ariaLabel}>
      <div className="la-panel__glow" aria-hidden="true" />
      <div className="la-panel__main">
        <div className="la-panel__copy">
          {eyebrow && (
            <span className="la-panel__eyebrow">
              {EyebrowIcon && <EyebrowIcon size={14} aria-hidden="true" />}
              {eyebrow}
            </span>
          )}
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {media}
      </div>

      {stats.length > 0 && (
        <div className="la-stat-grid">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <span key={stat.label}>
                <i className={`la-stat-grid__icon${stat.tone ? ` la-stat-grid__icon--${stat.tone}` : ""}`} aria-hidden="true">
                  {Icon && <Icon size={13} />}
                </i>
                <strong>{stat.value}</strong>
                <small>{stat.label}</small>
              </span>
            );
          })}
        </div>
      )}

      {meta && <p className="la-panel__meta">{meta}</p>}

      {onAction && actionLabel && (
        <button type="button" className="la-panel__action" onClick={onAction}>
          <span>{actionLabel}</span>
          <ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
