import React from "react";
import { BookOpen, Bookmark, ChevronLeft, Clapperboard, Film, Globe2, Sparkles, Tv } from "lucide-react";
import { Cover } from "../components/manga/Cover";
import { RemoteCover } from "../features/sources";
import { isVideoMediaType } from "../features/sources/mediaPresentation";
import { usesContainCover } from "../features/sources/coverDisplay";
import { useI18n } from "../i18n/I18nProvider";

const STAT_ICONS = {
  manga: BookOpen,
  novel: Sparkles,
  anime: Clapperboard,
  movie: Film,
  series: Tv,
};

export function FavoritesOverview({
  totalItems,
  stats = [],
  sourceCount,
  previewItems,
  onDiscover,
  variant = "reading",
  desktop = false,
}) {
  const { t } = useI18n();
  const isVideo = variant === "video";

  return (
    <section className={`favorites-hero${desktop ? " favorites-hero--desktop" : ""}`} aria-label={t("favorites.overview")}>
      <div className="favorites-hero__visual" aria-hidden="true">
        {previewItems.length > 0 ? (
          <div className="favorites-hero__stack">
            {previewItems.map((entry, index) => (
              <span
                key={entry.key}
                className="favorites-hero__cover"
                style={{ "--stack-index": index }}
              >
                {entry.kind === "demo" ? (
                  <Cover item={entry.item} />
                ) : (
                  <RemoteCover
                    src={entry.coverSrc || entry.item.cover}
                    title={entry.item.title}
                    sourceId={entry.item.sourceId}
                    video={isVideoMediaType(entry.type)}
                    novel={entry.type === "novel"}
                    contain={usesContainCover(entry.item.sourceId)}
                    priority={index === 0}
                  />
                )}
              </span>
            ))}
          </div>
        ) : (
          <span className="favorites-hero__placeholder">
            <Bookmark size={22} />
          </span>
        )}
      </div>

      <div className="favorites-hero__copy">
        <span className="favorites-hero__eyebrow">{t("favorites.personal")}</span>
        <h2>{totalItems ? t("favorites.savedN", { count: totalItems }) : t("favorites.saveWhatYouLove")}</h2>
        <p>
          {totalItems
            ? (isVideo ? t("favorites.returnFastVideo") : t("favorites.returnFast"))
            : (isVideo ? t("favorites.tapBookmarkVideo") : t("favorites.tapBookmark"))}
        </p>
        {totalItems > 0 && (
          <ul className="favorites-hero__stats">
            {stats.map((stat) => {
              const Icon = STAT_ICONS[stat.id] || BookOpen;
              return (
                <li key={stat.id}>
                  <Icon size={12} aria-hidden="true" />
                  <strong>{stat.count}</strong>
                  <span>{stat.label}</span>
                </li>
              );
            })}
            <li>
              <Globe2 size={12} aria-hidden="true" />
              <strong>{sourceCount}</strong>
              <span>{t("favorites.source")}</span>
            </li>
          </ul>
        )}
      </div>

      {onDiscover && (
        <button type="button" className="favorites-hero__action" onClick={onDiscover}>
          <span>{totalItems ? t("favorites.discoverNew") : t("favorites.startDiscover")}</span>
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
