import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpDown, Bell, BellRing, BookOpen, Bookmark, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clapperboard, ExternalLink, Lock, RefreshCw, Search, Tags, Wifi } from "lucide-react";
import { useToast } from "../../components/ui/ToastProvider";
import { getSourceProfile, resolveSourceId } from "../../config/sources";
import { AccessibleSearchField } from "../../components/ui/AccessibleSearchField";
import { ChipFilterBar, ChipFilterButton } from "../../components/ui/ChipFilterBar";
import { fetchSourceDetails } from "./sourceApi";
import { DetailsActionHub } from "./DetailsActionHub";
import { RemoteCover } from "./RemoteCover";
import { CoverAudioBadge } from "./CatalogCard";
import { useResolvedCoverUrl } from "./useResolvedCoverUrl";
import { findChapterByRecord } from "../../lib/readingProgress";
import { SourceLogo } from "./SourceLogo";
import { FollowAlertSheet } from "../updates/FollowAlertSheet";
import { contentTypes, resolveBookmarkType } from "./contentTypes";
import { burstSakuraFrom } from "../../lib/sakura/burst";
import { getMediaPresentation, formatEpisodeHeaderLabel } from "./mediaPresentation";
import {
  applyAudioLanguageToChapter,
  AUDIO_LANGUAGE_LABELS,
  pickDefaultAudioLanguage,
  resolveAvailableAudioLanguages,
} from "./audioLanguage";
import { useI18n } from "../../i18n/I18nProvider";
import {
  formatChapterPublishedLabel,
  formatDetailUpdatedAt,
  isChapterWithinNewWindow,
  parseChapterPublishedAt,
} from "../../lib/media/chapterTiming";

const chapterPageSize = 20;
const GALAXY_AUTHOR_CHAPTER_FILTER_SLUGS = new Set(["netherils-brilliance"]);

function ChapterListRow({ chapter, sourceName, isLatest, onOpen, presentation }) {
  const { t } = useI18n();
  const isPaid = Boolean(chapter.locked);
  const priceLabel = Number(chapter.price) > 0 ? t("details.coins", { n: chapter.price }) : "";
  const publishedLabel = formatChapterPublishedLabel(parseChapterPublishedAt(chapter));
  const metaLabel = isPaid
    ? t("details.requiresPurchase", { source: sourceName })
    : publishedLabel
      ? `${publishedLabel} · ${sourceName}`
      : `${chapter.date || t("details.available")} · ${sourceName}`;

  return (
    <button
      className={`chapter-row ${isPaid ? "chapter-row--locked" : ""}${presentation.isVideo ? " chapter-row--video" : ""}`}
      onClick={() => onOpen(chapter)}
      type="button"
      aria-label={isPaid ? presentation.lockedAria(chapter.name) : presentation.openAria(chapter.name)}
    >
      <span className="chapter-number">{chapter.number || "—"}</span>
      <span className="chapter-row__body">
        <span className="chapter-row__title">
          <strong>{formatEpisodeHeaderLabel(chapter.name && chapter.name !== chapter.number ? chapter.name : (chapter.number || chapter.name), presentation.rowPrefix)}</strong>
          {isPaid && (
            <span className="chapter-badge chapter-badge--paid">
              <Lock size={11} aria-hidden="true" />
              <span>{t("details.paid")}</span>
              {priceLabel && <span className="chapter-badge__price">{priceLabel}</span>}
            </span>
          )}
        </span>
        <small>{metaLabel}</small>
      </span>
      {isLatest && <span className={`new-badge ${isPaid ? "new-badge--paid" : ""}`}>{isPaid ? t("details.newPaid") : t("common.new")}</span>}
      {isPaid ? <ExternalLink size={16} className="chapter-row__external" aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}
    </button>
  );
}

function normalizeTaxonomy(value) {
  const entries = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,،]/) : [];
  return [...new Set(entries.map((entry) => (typeof entry === "string" ? entry : String(entry?.name || entry?.label || "")).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim()).filter(Boolean))];
}

function RelatedMoviesRow({ items, onOpen, mediaType }) {
  const { t } = useI18n();
  if (!items.length) return null;
  const isSeries = mediaType === "series";

  return (
    <section className="details-related" aria-labelledby="details-related-title">
      <div className="details-section-heading">
        <span>
          <small>{isSeries ? t("details.sameShow") : t("details.sameSeries")}</small>
          <h2 id="details-related-title">{isSeries ? t("details.otherSeasons") : t("details.relatedMovies")}</h2>
        </span>
        <Clapperboard size={19} />
      </div>
      <div className="details-related__scroller">
        {items.map((item) => (
          <button
            key={item.url || item.id}
            type="button"
            className="details-related__card"
            onClick={() => onOpen(item)}
            aria-label={t("details.viewDetails", { title: item.title })}
          >
            <RemoteCover
              src={item.cover}
              title={item.title}
              sourceId={item.sourceId}
              video
            />
            <strong dir="auto">{item.title}</strong>
            {item.year || item.altTitle ? <small dir="auto">{item.year || item.altTitle}</small> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

export function LiveMangaDetails({
  seed,
  isFavorite,
  onToggleFavorite,
  onBack,
  openLiveReader,
  onOpenRelated,
  readingProgress,
  chapterFollow,
}) {
  const { pushToast } = useToast();
  const { t } = useI18n();
  const sourceId = resolveSourceId(seed);
  const profile = getSourceProfile(sourceId);
  const [item, setItem] = useState(seed);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [taxonomiesExpanded, setTaxonomiesExpanded] = useState(false);
  const [chapterQuery, setChapterQuery] = useState("");
  const [chapterAuthor, setChapterAuthor] = useState("");
  const [chapterOrder, setChapterOrder] = useState("desc");
  const [chapterPage, setChapterPage] = useState(1);
  const [followSheetOpen, setFollowSheetOpen] = useState(false);
  const [audioLanguage, setAudioLanguage] = useState("VF");

  async function load() {
    setStatus("loading");
    setError("");
    try {
      const data = await fetchSourceDetails(sourceId, seed.url);
      const badCover = !data.cover || /\/images\.png$|Anime4up-Icon/i.test(data.cover);
      const seedCover = seed.cover && !/\/images\.png$|Anime4up-Icon/i.test(seed.cover) ? seed.cover : "";
      setItem({ ...seed, ...data, cover: badCover ? (seedCover || data.cover) : data.cover });
      setStatus("ready");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t("details.loadFailed");
      setError(message);
      setStatus("error");
      pushToast({ type: "error", message });
    }
  }

  useEffect(() => {
    setItem(seed);
    setSummaryExpanded(false);
    setTaxonomiesExpanded(false);
    setChapterQuery("");
    setChapterAuthor("");
    setChapterOrder("desc");
    setChapterPage(1);
    setAudioLanguage("VF");
    load();
  }, [seed.url, sourceId]);

  const chapters = item.chapters || [];
  const categories = normalizeTaxonomy(item.categories || item.genres);
  const tags = normalizeTaxonomy(item.tags);
  const chapterAuthors = useMemo(() => {
    if (!GALAXY_AUTHOR_CHAPTER_FILTER_SLUGS.has(item.id || "")) return [];
    const values = [...new Set(chapters.map((chapter) => chapter.author).filter(Boolean))];
    if (!values.length && item.author) return [item.author];
    return values;
  }, [chapters, item.author, item.id]);
  const filteredChapters = useMemo(() => {
    const normalized = chapterQuery.trim().toLowerCase();
    const matches = normalized ? chapters.filter((chapter) => `${chapter.number || ""} ${chapter.name || ""}`.toLowerCase().includes(normalized)) : chapters;
    const byAuthor = chapterAuthor
      ? matches.filter((chapter) => (chapter.author || item.author || "") === chapterAuthor)
      : matches;
    const sorted = [...byAuthor].sort((a, b) => {
      const diff = Number(b.number) - Number(a.number);
      if (Number.isFinite(diff) && diff !== 0) return diff;
      return String(b.url || "").localeCompare(String(a.url || ""), "ar");
    });
    return chapterOrder === "desc" ? sorted : [...sorted].reverse();
  }, [chapterAuthor, chapterOrder, chapterQuery, chapters, item.author]);
  const totalChapterPages = Math.max(1, Math.ceil(filteredChapters.length / chapterPageSize));
  const pagedChapters = filteredChapters.slice((chapterPage - 1) * chapterPageSize, chapterPage * chapterPageSize);

  useEffect(() => setChapterPage(1), [chapterAuthor, chapterOrder, chapterQuery]);
  useEffect(() => {
    if (!chapterAuthors.length) {
      setChapterAuthor("");
      return;
    }
    setChapterAuthor((current) => (current && chapterAuthors.includes(current) ? current : chapterAuthors[0]));
  }, [chapterAuthors, seed.url]);
  useEffect(() => { if (chapterPage > totalChapterPages) setChapterPage(totalChapterPages); }, [chapterPage, totalChapterPages]);

  const continueChapter = useMemo(() => {
    const raw = findChapterByRecord(chapters, readingProgress);
    return raw ? applyAudioLanguageToChapter(raw, audioLanguage, sourceId) : null;
  }, [audioLanguage, chapters, readingProgress, sourceId]);
  const latestChapter = useMemo(() => {
    const unlocked = chapters.filter((chapter) => !chapter.locked);
    if (!unlocked.length) return null;
    return [...unlocked].sort((a, b) => Number(b.number) - Number(a.number))[0];
  }, [chapters]);
  const latestChapterPublishedAt = useMemo(
    () => parseChapterPublishedAt(latestChapter),
    [latestChapter],
  );
  const isLatestChapterNew = useMemo(
    () => isChapterWithinNewWindow(latestChapterPublishedAt),
    [latestChapterPublishedAt],
  );
  const publicationStatusKey = item.publicationStatus && item.publicationStatus !== "unknown"
    ? item.publicationStatus
    : "";
  const publicationStatusLabel = publicationStatusKey
    ? t(`details.status.${publicationStatusKey}`)
    : (item.publicationStatusLabel || "");
  const lastUpdatedLabel = formatDetailUpdatedAt(item.lastUpdatedAt || latestChapterPublishedAt);
  const mediaType = resolveBookmarkType(item);
  const presentation = getMediaPresentation(mediaType);
  const isNovel = presentation.isNovel;
  const isVideo = presentation.isVideo;
  const availableAudioLanguages = useMemo(
    () => (isVideo ? resolveAvailableAudioLanguages(item, chapters, sourceId) : []),
    [chapters, isVideo, item, sourceId],
  );

  useEffect(() => {
    if (!availableAudioLanguages.length) return;
    setAudioLanguage((current) => pickDefaultAudioLanguage(availableAudioLanguages, current));
  }, [availableAudioLanguages, seed.url]);

  const metaCaption = isVideo
    ? [profile.arabicName || profile.name, item.totalEpisodes ? `${item.totalEpisodes} ${presentation.units}` : null]
      .filter(Boolean)
      .join(" · ")
    : [profile.arabicName || profile.name, sourceId === "galaxynovels" && item.author ? `${t("details.authorLabel")}: ${item.author}` : null]
      .filter(Boolean)
      .join(" · ");
  const chaptersCount = Math.max(chapters.length, Number(item.totalEpisodes) || 0);
  const coverBackdropUrl = useResolvedCoverUrl(sourceId, item.cover);
  const followPreference = chapterFollow?.getPreference(item);
  const isFollowing = Boolean(followPreference?.enabled);

  function resolveChapter(chapter) {
    return applyAudioLanguageToChapter(chapter, audioLanguage, sourceId);
  }

  function openChapter(chapter) {
    const resolved = resolveChapter(chapter);
    if (resolved.locked) window.open(resolved.url, "_blank", "noopener,noreferrer");
    else openLiveReader({ ...item, preferredAudioLanguage: audioLanguage }, resolved);
  }

  return (
    <div className={`screen screen--live-details${isVideo ? " screen--live-video screen--live-anime" : ""}`}>
      <div className={`live-details-hero${presentation.heroClass ? ` ${presentation.heroClass}` : ""}`}>
        {coverBackdropUrl && (
          <div className="live-details-hero__backdrop" aria-hidden="true">
            <img src={coverBackdropUrl} alt="" />
            <span className="live-details-hero__backdrop-fade" />
          </div>
        )}
        <div className="details-hero__nav">
          <button className="icon-button icon-button--glass" onClick={onBack} aria-label={t("common.back")}><ArrowRight size={20} /></button>
          <div className="details-hero__actions">
            <button className={`icon-button icon-button--glass details-favorite ${isFavorite ? "active" : ""}`} onClick={(event) => { if (!isFavorite) burstSakuraFrom(event.currentTarget); onToggleFavorite(item); }} aria-label={isFavorite ? t("reader.header.removeFavorite") : t("reader.header.addFavorite")} aria-pressed={isFavorite}><Bookmark size={19} fill={isFavorite ? "currentColor" : "none"} /></button>
            {chapterFollow && (
              <button
                type="button"
                className={`icon-button icon-button--glass details-follow${isFollowing ? " active" : ""}`}
                onClick={() => setFollowSheetOpen(true)}
                aria-label={isFollowing ? t("details.following") : t("details.followUpdates")}
                aria-pressed={isFollowing}
              >
                {isFollowing ? <BellRing size={19} /> : <Bell size={19} />}
              </button>
            )}
            <a className="icon-button icon-button--glass" href={seed.url} target="_blank" rel="noopener noreferrer" aria-label={t("details.openInSource")}><ExternalLink size={19} /></a>
          </div>
        </div>
        <div className="live-details-hero__content">
          <figure className="live-details-hero__cover">
            <RemoteCover
              src={item.cover}
              title={item.title}
              sourceId={sourceId}
              hero
              novel={isNovel}
              video={isVideo}
              priority
            />
            <CoverAudioBadge label={item.audioLabel} />
          </figure>
          <div className="live-details-hero__meta">
            <div className="details-source-line">
              <SourceLogo sourceId={sourceId} />
              <span className="pill pill--light">{profile.name}</span>
              <span className={`media-type-badge media-type-badge--${mediaType}`}>
                {item.mediaTypeLabel || contentTypes[mediaType]?.singular || presentation.badgeLabel}
              </span>
              {publicationStatusLabel ? (
                <span className={`publication-status publication-status--${publicationStatusKey || "unknown"}`}>
                  {publicationStatusLabel}
                </span>
              ) : null}
            </div>
            <h1 className="live-details-hero__title" dir="auto">{item.title}</h1>
            {item.altTitle && <p className="live-details-hero__subtitle" dir="auto">{item.altTitle}</p>}
            <small dir="auto">{metaCaption}</small>
            {lastUpdatedLabel ? (
              <small className="live-details-hero__updated" dir="auto">
                {t("details.lastUpdated")}: {lastUpdatedLabel}
              </small>
            ) : null}
          </div>
        </div>
      </div>
      <main className="content details-content">
        {status === "loading" ? (
          <>
            <div className="catalog-reload" role="status" aria-live="polite">
              <RefreshCw size={15} aria-hidden="true" />
              <span>
                <strong>{presentation.loadingList}</strong>
                <small>{t("sources.connecting")}</small>
              </span>
            </div>
            <div className="chapter-list live-chapter-list" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="chapter-row-skeleton" key={index}>
                  <span />
                  <span />
                </div>
              ))}
            </div>
          </>
        ) : status === "error" ? <div className="live-error"><Wifi size={30} /><h2>{t("details.loadDetailsFailed")}</h2><p>{error}</p><button className="button button--primary" onClick={load}><RefreshCw size={17} /> {t("common.retry")}</button></div> : <>
          {availableAudioLanguages.length > 1 && (
            <section className="details-audio-language" aria-label={t("details.audioVersionAria")}>
              <div className="details-audio-language__head">
                <strong>{t("details.audioVersion")}</strong>
                <small>{t("details.chooseBeforePlay")}</small>
              </div>
              <ChipFilterBar variant="segmented" className="details-audio-language__chips" role="group" ariaLabel={t("details.audioVersion")}>
                {availableAudioLanguages.map((language) => (
                  <ChipFilterButton
                    key={language}
                    active={audioLanguage === language}
                    onClick={() => setAudioLanguage(language)}
                  >
                    {AUDIO_LANGUAGE_LABELS[language] || language}
                  </ChipFilterButton>
                ))}
              </ChipFilterBar>
            </section>
          )}
          <DetailsActionHub
            mediaType={mediaType}
            chaptersCount={chaptersCount}
            latestChapter={latestChapter ? resolveChapter(latestChapter) : null}
            sourceName={profile.name}
            readingProgress={readingProgress}
            continueChapter={continueChapter}
            onOpenChapter={openChapter}
          />
          {item.summary && <section className={`about details-about ${summaryExpanded ? "expanded" : ""}`}><div className="details-section-heading"><span><small>{t("details.aboutWork")}</small><h2>{t("details.synopsis")}</h2></span></div><p dir="auto">{item.summary}</p>{item.summary.length > 260 && <button className="details-about__toggle" onClick={() => setSummaryExpanded((expanded) => !expanded)} aria-expanded={summaryExpanded}>{summaryExpanded ? <><ChevronUp size={15} /> {t("details.showLess")}</> : <><ChevronDown size={15} /> {t("details.showFullSynopsis")}</>}</button>}</section>}
          {isVideo && onOpenRelated && (
            <RelatedMoviesRow
              items={item.relatedItems || []}
              onOpen={onOpenRelated}
              mediaType={mediaType}
            />
          )}
          {(categories.length > 0 || tags.length > 0) && <section className="details-taxonomies" aria-labelledby="details-taxonomies-title"><div className="details-section-heading"><span><small>{t("details.sourceMetadata")}</small><h2 id="details-taxonomies-title">{t("details.categoriesAndTags")}</h2></span><Tags size={19} /></div>{categories.length > 0 && <div className="details-taxonomy-group"><strong>{t("details.categories")}</strong><div>{(taxonomiesExpanded ? categories : categories.slice(0, 8)).map((category) => <span className="details-taxonomy-chip details-taxonomy-chip--category" key={category}>{category}</span>)}</div></div>}{tags.length > 0 && <div className="details-taxonomy-group"><strong>{t("details.tags")}</strong><div>{(taxonomiesExpanded ? tags : tags.slice(0, 8)).map((tag) => <span className="details-taxonomy-chip" key={tag}>#{tag}</span>)}</div></div>}{(categories.length > 8 || tags.length > 8) && <button className="details-taxonomies__toggle" onClick={() => setTaxonomiesExpanded((expanded) => !expanded)} aria-expanded={taxonomiesExpanded}>{taxonomiesExpanded ? <><ChevronUp size={15} /> {t("details.showLess")}</> : <><ChevronDown size={15} /> {t("details.showAll", { count: categories.length + tags.length })}</>}</button>}</section>}
          <section className="details-chapters" aria-labelledby="details-chapters-title">
            <div className="details-section-heading"><span><small>{t("details.organizedList")}</small><h2 id="details-chapters-title">{presentation.sectionTitle}</h2></span><strong>{filteredChapters.length}</strong></div>
            {chapters.length > 8 && <div className="chapter-tools"><AccessibleSearchField className="global-search chapter-search" value={chapterQuery} onChange={setChapterQuery} placeholder={presentation.searchPlaceholder} ariaLabel={t("details.searchInUnits", { units: presentation.units })} /><button className="chapter-order" onClick={() => setChapterOrder((order) => order === "desc" ? "asc" : "desc")}><ArrowUpDown size={16} /><span>{chapterOrder === "desc" ? t("details.newestFirst") : t("details.oldestFirst")}</span></button></div>}
            {chapterAuthors.length > 0 && (
              <ChipFilterBar variant="segmented" className="details-chapter-author-filter" role="group" ariaLabel={t("details.authorFilterAria")}>
                {chapterAuthors.map((author) => (
                  <ChipFilterButton
                    key={author}
                    active={chapterAuthor === author}
                    onClick={() => setChapterAuthor(author)}
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
                    sourceName={profile.name}
                    isLatest={chapter.url === latestChapter?.url && isLatestChapterNew}
                    onOpen={openChapter}
                    presentation={presentation}
                  />
                ))}
              </div>
            ) : chapters.length ? <div className="empty-state empty-state--compact"><Search size={29} /><h2>{presentation.noMatch}</h2><p>{t("details.tryDifferentSearch")}</p><button onClick={() => setChapterQuery("")}>{t("common.clearSearch")}</button></div> : <div className="empty-state empty-state--compact"><BookOpen size={31} /><h2>{presentation.emptyList}</h2></div>}
            {filteredChapters.length > chapterPageSize && <nav className="chapter-pagination" aria-label={presentation.paginationAria}><button onClick={() => setChapterPage((page) => Math.max(1, page - 1))} disabled={chapterPage === 1} aria-label={t("common.previous")}><ChevronRight size={17} /></button><span><small>{t("common.page")}</small><strong>{chapterPage}</strong><small>{t("common.of", { total: totalChapterPages })}</small></span><button onClick={() => setChapterPage((page) => Math.min(totalChapterPages, page + 1))} disabled={chapterPage === totalChapterPages} aria-label={t("common.next")}><ChevronLeft size={17} /></button></nav>}
          </section>
        </>}
      </main>
      {followSheetOpen && chapterFollow && (
        <FollowAlertSheet
          item={item}
          preference={followPreference}
          onSave={(partial) => {
            chapterFollow.savePreference(item, partial, latestChapter);
            pushToast({ type: "success", message: t("follow.saved") });
            setFollowSheetOpen(false);
          }}
          onDisable={() => {
            chapterFollow.removePreference(item);
            pushToast({ type: "info", message: t("follow.stopped") });
            setFollowSheetOpen(false);
          }}
          onClose={() => setFollowSheetOpen(false)}
        />
      )}
    </div>
  );
}
