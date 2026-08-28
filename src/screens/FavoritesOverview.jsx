import React from "react";
import { BookOpen, Bookmark, ChevronLeft, Globe2, Sparkles } from "lucide-react";
import { Cover } from "../components/manga/Cover";
import { RemoteCover } from "../features/sources";
import { useI18n } from "../i18n/I18nProvider";

export function FavoritesOverview({ totalItems, mangaCount, novelCount, sourceCount, previewItems, onDiscover }) {
  const { t } = useI18n();

  return (
    <section className="favorites-hero" aria-label={t("favorites.overview")}>
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
                  <RemoteCover src={entry.item.cover} title={entry.item.title} sourceId={entry.item.sourceId} />
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
            ? t("favorites.returnFast")
            : t("favorites.tapBookmark")}
        </p>
        {totalItems > 0 && (
          <ul className="favorites-hero__stats">
            <li>
              <BookOpen size={12} aria-hidden="true" />
              <strong>{mangaCount}</strong>
              <span>{t("content.mangaSingular")}</span>
            </li>
            <li>
              <Sparkles size={12} aria-hidden="true" />
              <strong>{novelCount}</strong>
              <span>{t("content.novelSingular")}</span>
            </li>
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
