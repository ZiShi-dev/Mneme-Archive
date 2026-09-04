import React, { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { t } from "../../i18n/runtime.js";
import { getSourceProfile, initialSourcePreferences } from "../../config/sources";
import { SourceLogo } from "../../features/sources";
import {
  DEFAULT_SOURCE_STACK_METRICS,
  resolveVisibleSourceStackCount,
} from "./sourceStackLayout";

export const SOURCE_SCOPE_STACK_LIMIT = 4;
export const SOURCE_SCOPE_COMPACT_THRESHOLD = 4;

export function buildSourceScopeCopy(sources, sourcePreferences) {
  const count = sources.length;
  const names = sources.map((source) => getSourceProfile(source.id).name);
  const title = count <= 3 ? names.join(" · ") : t("sources.hubActiveCount", { count });
  const selectedCount = sources.filter((source) => {
    const preference = { ...initialSourcePreferences[source.id], ...sourcePreferences[source.id] };
    return preference.mode === "selected";
  }).length;
  let subtitle = t("sources.scopeAllFull");
  if (selectedCount === count && count > 0) subtitle = t("sources.scopeAllSelected");
  else if (selectedCount > 0) subtitle = t("sources.scopeMixed", { selected: selectedCount, count });
  return { title, subtitle };
}

function readStackMetrics(probe) {
  if (!probe) return DEFAULT_SOURCE_STACK_METRICS;

  const avatarSize = probe.offsetWidth;
  const marginStart = Math.abs(parseFloat(getComputedStyle(probe).marginInlineStart) || 0);
  return {
    avatarSize: avatarSize || DEFAULT_SOURCE_STACK_METRICS.avatarSize,
    overlap: marginStart || DEFAULT_SOURCE_STACK_METRICS.overlap,
  };
}

function useVisibleSourceStack(sources, avatarsRef, probeRef, copySignature) {
  const [stack, setStack] = useState(() => ({
    visible: sources.length,
    hidden: 0,
  }));

  useLayoutEffect(() => {
    const avatars = avatarsRef.current;
    if (!avatars) return undefined;

    const measure = () => {
      const availableWidth = avatars.clientWidth;
      const metrics = readStackMetrics(probeRef.current);
      setStack(resolveVisibleSourceStackCount(sources.length, availableWidth, metrics));
    };

    const observer = new ResizeObserver(measure);
    observer.observe(avatars);
    measure();

    return () => observer.disconnect();
  }, [avatarsRef, copySignature, probeRef, sources.length]);

  return stack;
}

export function SourceScopeBar({
  sources,
  sourcePreferences,
  onClick,
  onPointerDown,
  className = "",
  ariaLabel = t("sources.scopeAria"),
}) {
  const avatarsRef = useRef(null);
  const probeRef = useRef(null);
  const { title, subtitle } = buildSourceScopeCopy(sources, sourcePreferences);
  const copySignature = `${title}|${subtitle}`;
  const { visible, hidden } = useVisibleSourceStack(sources, avatarsRef, probeRef, copySignature);
  const stackSources = sources.slice(0, visible);

  return (
    <button
      type="button"
      className={`search-scope ${className}`.trim()}
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-label={ariaLabel}
    >
      <span className="search-scope__avatars" ref={avatarsRef}>
        <span
          ref={probeRef}
          className="search-scope__avatar search-scope__avatar--measure"
          aria-hidden="true"
        >
          <SourceLogo sourceId={sources[0]?.id || "mangalik"} />
        </span>
        {stackSources.map((source, index) => (
          <span
            key={source.id}
            className="search-scope__avatar"
            style={{ zIndex: stackSources.length - index }}
            aria-hidden="true"
          >
            <SourceLogo sourceId={source.id} />
          </span>
        ))}
        {hidden > 0 && <span className="search-scope__more">+{hidden}</span>}
      </span>
      <span className="search-scope__copy">
        <strong dir="ltr">{title}</strong>
        <small>{subtitle}</small>
      </span>
      <ChevronLeft size={15} className="search-scope__chevron" aria-hidden="true" />
    </button>
  );
}
