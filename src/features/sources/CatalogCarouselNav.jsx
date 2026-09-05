import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../../i18n/I18nProvider";

export function CatalogCarouselNav({ page, hasMore, loadingMore, error, onPrevious, onNext, onGoToPage }) {
  const { t, dir } = useI18n();
  const [open, setOpen] = useState(false);
  const [draftPage, setDraftPage] = useState(String(page));

  useEffect(() => {
    setDraftPage(String(page));
  }, [page]);

  const commitPage = async () => {
    const nextPage = Number.parseInt(draftPage, 10);
    if (!Number.isFinite(nextPage) || nextPage < 1) {
      setDraftPage(String(page));
      return;
    }
    if (nextPage === page) return;
    const landedPage = await onGoToPage(nextPage);
    setDraftPage(String(typeof landedPage === "number" ? landedPage : page));
  };

  const navLabel = `${t("sources.catalogNav")} — ${t("sources.view.page", { page })}`;

  return (
    <section
      className={`catalog-carousel-nav${open ? " is-open" : ""}`}
      dir={dir}
      aria-label={navLabel}
    >
      <div className="catalog-carousel-nav__shell">
        <div className="catalog-carousel-nav__rail">
          <button
            type="button"
            className="catalog-carousel-nav__icon"
            onClick={onPrevious}
            disabled={page === 1 || loadingMore}
            aria-label={t("common.previous")}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="catalog-carousel-nav__page"
            onClick={() => setOpen(true)}
            aria-label={open ? navLabel : t("sources.catalogNavShow")}
          >
            <span className="catalog-carousel-nav__page-value">{page}</span>
            {!open && <span className="catalog-carousel-nav__page-label">{t("common.page")}</span>}
          </button>

          <button
            type="button"
            className="catalog-carousel-nav__icon"
            onClick={onNext}
            disabled={!hasMore || loadingMore}
            aria-label={t("common.next")}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>

          <span className="catalog-carousel-nav__divider" aria-hidden="true" />

          <button
            type="button"
            className="catalog-carousel-nav__icon catalog-carousel-nav__icon--toggle"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-label={open ? t("sources.catalogNavHide") : t("sources.catalogNavShow")}
          >
            <ChevronDown size={15} />
          </button>
        </div>

        {open && (
          <div className="catalog-carousel-nav__drawer">
            <p className="catalog-carousel-nav__hint catalog-carousel-nav__hint--touch">{t("sources.swipeHint")}</p>
            <label className="catalog-carousel-nav__jump">
              <span>{t("sources.goToPage")}</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                className="catalog-carousel-nav__jump-input"
                value={draftPage}
                onChange={(event) => setDraftPage(event.target.value)}
                onBlur={commitPage}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitPage();
                    event.currentTarget.blur();
                  }
                }}
                aria-label={t("sources.pageNumber")}
                disabled={loadingMore}
              />
            </label>
          </div>
        )}
      </div>
      {error && <p className="catalog-carousel-nav__error">{error}</p>}
    </section>
  );
}
