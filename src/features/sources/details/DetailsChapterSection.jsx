import React from "react";
import { ArrowUpDown, BookOpen, Check, ChevronLeft, ChevronRight, Download, ExternalLink, Lock, Search } from "lucide-react";
import { AccessibleSearchField } from "../../../components/ui/AccessibleSearchField";
import { ChipFilterBar, ChipFilterButton } from "../../../components/ui/ChipFilterBar";
import { ChapterListSkeleton } from "../../../components/ui/ContentSkeleton";
import { UnlockCountdown } from "../../../components/media/UnlockCountdown";
import { useI18n } from "../../../i18n/I18nProvider";
import { isAzoraChapterBlocked, isDetailsChapterPaid } from "../../../lib/media/chapterLock";
import { getChapterReadState } from "../../../lib/storage/chapterProgress";
import { formatChapterPublishedLabel, parseChapterPublishedAt } from "../../../lib/media/chapterTiming";
import { AUDIO_LANGUAGE_LABELS } from "../audioLanguage";
import { formatEpisodeHeaderLabel } from "../mediaPresentation";
import { isChapterOfflineStatus } from "../../../lib/downloads/useNovelDownloads";

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chapterDisplayTitle(chapter, presentation) {
  const number = String(chapter.number || "").trim();
  const name = String(chapter.name || "").trim();
  const unit = presentation.rowPrefix;
  if (name && name !== number) {
    const stripped = name
      .replace(new RegExp(`^${escapeRegExp(unit)}\\s*`, "i"), "")
      .replace(new RegExp(`^${escapeRegExp(number)}\\s*[·•\\-–:]\\s*`), "")
      .trim();
    if (stripped && stripped !== number) return stripped;
  }
  return formatEpisodeHeaderLabel(number || name, unit);
}

function ChapterListRow({
  chapter,
  sourceId,
  sourceName,
  isLatest,
  onOpen,
  onPrefetch,
  onDownload,
  downloaded = false,
  downloading = false,
  presentation,
  activeAudioLanguage = "",
  chapterReadEntries = [],
}) {
  const { t } = useI18n();
  const isPaid = isDetailsChapterPaid(sourceId, chapter);
  const blocked = isAzoraChapterBlocked(sourceId, chapter);
  const priceLabel = Number(chapter.price) > 0 ? t("details.coins", { n: chapter.price }) : "";
  const publishedLabel = formatChapterPublishedLabel(parseChapterPublishedAt(chapter));
  const title = chapterDisplayTitle(chapter, presentation);
  const { progress, read, inProgress } = getChapterReadState(sourceId, chapter, chapterReadEntries);
  const showRead = !blocked && !isPaid && read;
  const episodeLanguages = Object.keys(chapter.audioLanguages || {}).filter((entry) => AUDIO_LANGUAGE_LABELS[entry]);
  const metaLabel = blocked
    ? (chapter.unlockAt ? "" : t("details.permanentlyLocked"))
    : isPaid
      ? (chapter.lockReason === "sky-app" ? t("details.skyAppOnly") : t("details.requiresPurchase", { source: sourceName }))
      : publishedLabel || "";

  return (
    <div className={onDownload ? "chapter-row-wrap" : undefined}>
      <button
        className={`chapter-row ${isPaid ? "chapter-row--locked" : ""}${showRead ? " chapter-row--read" : ""}${inProgress ? " chapter-row--progress" : ""}${presentation.isVideo ? " chapter-row--video" : ""}`}
        onPointerDown={() => { if (!blocked && !isPaid) onPrefetch?.(chapter); }}
        onClick={() => { if (!blocked) onOpen(chapter); }}
        type="button"
        disabled={blocked}
        aria-disabled={blocked ? "true" : undefined}
        aria-label={isPaid ? presentation.lockedAria(chapter.name) : presentation.openAria(chapter.name)}
      >
      <span className="chapter-number">
        {showRead ? <Check size={14} aria-hidden="true" className="chapter-number__read" /> : (chapter.number || "—")}
      </span>
      <span className="chapter-row__body">
        <span className="chapter-row__title">
          <strong>{title}</strong>
          {isPaid && (
            <span className="chapter-badge chapter-badge--paid">
              <Lock size={11} aria-hidden="true" />
              <span>{chapter.lockReason === "sky-app" ? t("details.skyAppOnly") : (blocked && !chapter.unlockAt ? t("details.permanentlyLocked") : t("details.paid"))}</span>
              {priceLabel && <span className="chapter-badge__price">{priceLabel}</span>}
            </span>
          )}
          {showRead ? (
            <span className="chapter-badge chapter-badge--read">
              <Check size={11} aria-hidden="true" />
              <span>{t("details.chapterRead")}</span>
            </span>
          ) : null}
        </span>
        {blocked ? <UnlockCountdown unlockAt={chapter.unlockAt} className="chapter-row__countdown" /> : null}
        {inProgress ? <small className="chapter-row__progress">{progress}%</small> : null}
        {!inProgress && metaLabel ? <small>{metaLabel}</small> : null}
        {episodeLanguages.length > 0 && (
          <span className="chapter-row__audio-tags" aria-label={t("details.audioVersionAria")}>
            {episodeLanguages.map((language) => (
              <em
                key={language}
                className={`chapter-row__audio-tag${activeAudioLanguage === language ? " is-active" : ""}`}
              >
                {AUDIO_LANGUAGE_LABELS[language] || language}
              </em>
            ))}
          </span>
        )}
      </span>
      {isLatest && <span className={`new-badge ${isPaid ? "new-badge--paid" : ""}`}>{isPaid ? t("details.newPaid") : t("common.new")}</span>}
      {blocked ? null : isPaid ? <ExternalLink size={16} className="chapter-row__external" aria-hidden="true" /> : !showRead ? <ChevronLeft size={18} aria-hidden="true" /> : null}
      </button>
      {onDownload && !blocked && !isPaid ? (
        <button
          type="button"
          className={`chapter-row__download${downloaded ? " is-complete" : ""}`}
          disabled={downloading}
          onClick={(event) => {
            event.stopPropagation();
            onDownload(chapter);
          }}
          aria-label={downloaded ? t("downloads.novel.alreadySaved") : t("downloads.novel.downloadChapter")}
        >
          <Download size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function DetailsChapterSection({
  status,
  isChromebookApp,
  presentation,
  chapters,
  filteredChapters,
  pagedChapters,
  chapterQuery,
  onChapterQueryChange,
  chapterAuthors,
  chapterAuthor,
  onChapterAuthorChange,
  chapterOrder,
  onChapterOrderToggle,
  chapterPage,
  onChapterPageChange,
  totalChapterPages,
  chapterPageSize,
  latestChapter,
  isLatestChapterNew,
  sourceId,
  sourceName,
  audioLanguage,
  onOpenChapter,
  onPrefetchChapter,
  onDownloadChapter,
  downloadedChapterUrls = null,
  seriesUrl = "",
  chapterReadEntries = [],
}) {
  const { t } = useI18n();

  return (
    <section
      className={`details-chapters${isChromebookApp ? " details-chapters--desktop" : ""}${status === "loading" ? " details-chapters--loading" : ""}`}
      aria-labelledby="details-chapters-title"
      aria-busy={status === "loading"}
    >
      <div className="details-section-heading">
        <h2 id="details-chapters-title">{presentation.sectionTitle}</h2>
        <strong>{status === "loading" ? "…" : filteredChapters.length}</strong>
      </div>
      {status === "loading" ? (
        <ChapterListSkeleton count={8} label={presentation.loadingList} />
      ) : (
        <>
          {chapters.length > 3 && (
            <div className="chapter-tools">
              <AccessibleSearchField
                className="global-search chapter-search"
                value={chapterQuery}
                onChange={onChapterQueryChange}
                placeholder={presentation.searchPlaceholder}
                ariaLabel={t("details.searchInUnits", { units: presentation.units })}
              />
              <button
                className={`chapter-order${chapterOrder === "asc" ? " chapter-order--asc" : ""}`}
                onClick={onChapterOrderToggle}
                type="button"
                aria-label={chapterOrder === "desc" ? t("details.newestFirst") : t("details.oldestFirst")}
              >
                <ArrowUpDown size={16} aria-hidden="true" />
                <span className="chapter-order__label">{chapterOrder === "desc" ? t("details.newestFirst") : t("details.oldestFirst")}</span>
              </button>
            </div>
          )}
          {chapterAuthors.length > 0 && (
            <ChipFilterBar variant="segmented" className="details-chapter-author-filter" role="group" ariaLabel={t("details.authorFilterAria")}>
              {chapterAuthors.map((author) => (
                <ChipFilterButton
                  key={author}
                  active={chapterAuthor === author}
                  onClick={() => onChapterAuthorChange(author)}
                >
                  {author}
                </ChipFilterButton>
              ))}
            </ChipFilterBar>
          )}
          {pagedChapters.length ? (
            <div className="chapter-list live-chapter-list">
              {pagedChapters.map((chapter) => (
                <ChapterListRow
                  key={chapter.url}
                  chapter={chapter}
                  sourceId={sourceId}
                  sourceName={sourceName}
                  isLatest={chapter.url === latestChapter?.url && isLatestChapterNew}
                  onOpen={onOpenChapter}
                  onPrefetch={onPrefetchChapter}
                  onDownload={onDownloadChapter}
                  downloaded={onDownloadChapter ? isChapterOfflineStatus(downloadedChapterUrls, sourceId, seriesUrl, chapter.url) : false}
                  downloading={false}
                  presentation={presentation}
                  activeAudioLanguage={audioLanguage}
                  chapterReadEntries={chapterReadEntries}
                />
              ))}
            </div>
          ) : chapters.length ? (
            <div className="empty-state empty-state--compact">
              <Search size={29} />
              <h2>{presentation.noMatch}</h2>
              <p>{t("details.tryDifferentSearch")}</p>
              <button type="button" onClick={() => onChapterQueryChange("")}>{t("common.clearSearch")}</button>
            </div>
          ) : (
            <div className="empty-state empty-state--compact">
              <BookOpen size={31} />
              <h2>{presentation.emptyList}</h2>
            </div>
          )}
          {filteredChapters.length > chapterPageSize && (
            <nav className="chapter-pagination" aria-label={presentation.paginationAria}>
              <button type="button" onClick={() => onChapterPageChange(Math.max(1, chapterPage - 1))} disabled={chapterPage === 1} aria-label={t("common.previous")}>
                <ChevronRight size={17} />
              </button>
              <span>
                <small>{t("common.page")}</small>
                <strong>{chapterPage}</strong>
                <small>{t("common.of", { total: totalChapterPages })}</small>
              </span>
              <button type="button" onClick={() => onChapterPageChange(Math.min(totalChapterPages, chapterPage + 1))} disabled={chapterPage === totalChapterPages} aria-label={t("common.next")}>
                <ChevronLeft size={17} />
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
