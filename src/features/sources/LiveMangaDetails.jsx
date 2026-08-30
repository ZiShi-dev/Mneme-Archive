import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bell, BellRing, Bookmark, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Wifi } from "lucide-react";
import { useToast } from "../../components/ui/ToastProvider";
import { getSourceProfile, resolveSourceId } from "../../config/sources";
import { ChipFilterBar, ChipFilterButton } from "../../components/ui/ChipFilterBar";
import { isChromebookApp, isNotifiableMediaType, PREFERRED_AUDIO_LANGUAGE } from "../../config/appFlavor";
import { fetchSourceDetails, formatSourceError } from "./sourceApi";
import { normalizeChapterList, chapterSortKey } from "../../../server/lib/chapterOrdering.js";
import { DetailsActionHub } from "./DetailsActionHub";
import { DetailsCinematicHero } from "./details/DetailsCinematicHero";
import { DetailsHeroMeta } from "./details/DetailsHeroMeta";
import {
  buildDetailsHeroClasses,
  buildDetailsScreenClasses,
  buildMovieFactChips,
  getDetailsHeroLayout,
  isMovieMediaType,
  shouldShowChapterList,
} from "./details/detailsLayout";
import { MovieWatchActions } from "./details/MovieWatchActions";
import { RemoteCover } from "./RemoteCover";
import { usesContainCover } from "./coverDisplay";
import { CoverAudioBadge } from "./CatalogCard";
import { useResolvedCoverUrl } from "./useResolvedCoverUrl";
import { findChapterByRecord } from "../../lib/readingProgress";
import { DetailsChapterSection } from "./details/DetailsChapterSection";
import { DetailsContentSkeleton } from "../../components/ui/ContentSkeleton";
import { FollowAlertSheet } from "../updates/FollowAlertSheet";
import { contentTypes, resolveBookmarkType } from "./contentTypes";
import { burstSakuraFrom } from "../../lib/sakura/burst";
import { getMediaPresentation } from "./mediaPresentation";
import {
  applyAudioLanguageToChapter,
  AUDIO_LANGUAGE_LABELS,
  pickDefaultAudioLanguage,
  resolveAvailableAudioLanguages,
} from "./audioLanguage";
import { useI18n } from "../../i18n/I18nProvider";
import {
  isChapterWithinNewWindow,
  parseChapterPublishedAt,
} from "../../lib/media/chapterTiming";

const chapterPageSize = 20;
const GALAXY_AUTHOR_CHAPTER_FILTER_SLUGS = new Set(["netherils-brilliance"]);

function isNoiseTag(value) {
  return /^(vf|vostfr|vf\+vostfr|vostfr\+vf|hd|4k|fhd)$/i.test(String(value).replace(/\s/g, ""));
}

function isMetadataAltTitle(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  const compact = text.replace(/\s/g, "");
  if (/^(VF\+VOSTFR|VOSTFR\+VF|VOSTFR|VF)([·•|,/\-].*)?$/i.test(compact)) return true;
  if (/(VF|VOSTFR).*(Ep|Ép|HD|4K)/i.test(text)) return true;
  if (/^\d{4}(\s*[·•|,/\-].*)?$/i.test(text) && text.length < 48) return true;
  if (/^(Ep|Ép)\.?\s*\d+/i.test(text)) return true;
  return false;
}

function AudioLanguagePicker({ languages, value, onChange, className = "" }) {
  const { t } = useI18n();
  if (!languages.length) return null;

  return (
    <div className={`details-audio-language ${className}`.trim()} aria-label={t("details.audioVersionAria")}>
      <span className="details-audio-language__label">{t("details.audioVersion")}</span>
      <ChipFilterBar variant="segmented" className="details-audio-language__chips" role="group" ariaLabel={t("details.audioVersion")}>
        {languages.map((language) => (
          <ChipFilterButton
            key={language}
            active={value === language}
            onClick={() => onChange(language)}
          >
            {AUDIO_LANGUAGE_LABELS[language] || language}
          </ChipFilterButton>
        ))}
      </ChipFilterBar>
    </div>
  );
}

function normalizeTaxonomy(value) {
  const entries = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,،]/) : [];
  return [...new Set(entries.map((entry) => (typeof entry === "string" ? entry : String(entry?.name || entry?.label || "")).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim()).filter(Boolean))];
}

function RelatedMoviesRow({ items, onOpen, mediaType, layout = "scroll" }) {
  const { t } = useI18n();
  if (!items.length) return null;
  const isSeries = mediaType === "series";

  return (
    <section className={`details-related details-related--${layout}`} aria-labelledby="details-related-title">
      <div className="details-section-heading">
        <h2 id="details-related-title">{isSeries ? t("details.otherSeasons") : t("details.relatedMovies")}</h2>
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
              contain={usesContainCover(item.sourceId)}
            />
            <span className="details-related__copy">
              <strong dir="auto">{item.title}</strong>
              {item.year || item.altTitle ? <small dir="auto">{item.year || item.altTitle}</small> : null}
            </span>
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
  const { t, dir } = useI18n();
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
  const [audioLanguage, setAudioLanguage] = useState(PREFERRED_AUDIO_LANGUAGE);
  const loadGeneration = useRef(0);

  const loadDetails = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setStatus("loading");
    setError("");
    try {
      const data = await fetchSourceDetails(sourceId, seed.url);
      if (generation !== loadGeneration.current) return;
      const badCover = !data.cover || /\/images\.png$|Anime4up-Icon/i.test(data.cover);
      const seedCover = seed.cover && !/\/images\.png$|Anime4up-Icon/i.test(seed.cover) ? seed.cover : "";
      setItem({
        ...seed,
        ...data,
        cover: badCover ? (seedCover || data.cover) : data.cover,
        chapters: data.chapters?.length ? normalizeChapterList(data.chapters) : data.chapters,
      });
      setStatus("ready");
    } catch (reason) {
      if (generation !== loadGeneration.current) return;
      const message = formatSourceError(reason, t("details.loadFailed"));
      setError(message);
      setStatus("error");
      pushToast({ type: "error", message });
    }
  }, [pushToast, seed, sourceId, t]);

  useEffect(() => {
    setItem(seed);
    setSummaryExpanded(false);
    setTaxonomiesExpanded(false);
    setChapterQuery("");
    setChapterAuthor("");
    setChapterOrder("desc");
    setChapterPage(1);
    setFollowSheetOpen(false);
    setAudioLanguage(PREFERRED_AUDIO_LANGUAGE);
    loadDetails();
    return () => { loadGeneration.current += 1; };
  }, [seed.url, sourceId, loadDetails]);

  const chapters = item.chapters || [];
  const categories = normalizeTaxonomy(item.categories || item.genres).filter((entry) => !isNoiseTag(entry));
  const tags = normalizeTaxonomy(item.tags).filter((entry) => !isNoiseTag(entry));
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
      const diff = chapterSortKey(b) - chapterSortKey(a);
      if (diff !== 0) return diff;
      return String(b.url || "").localeCompare(String(a.url || ""), undefined, { numeric: true });
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
  const mediaType = resolveBookmarkType(item);
  const isMoviePage = isMovieMediaType(mediaType);
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

  const typeLabel = contentTypes[mediaType]?.singular || presentation.badgeLabel;
  const altTitle = String(item.altTitle || "").trim();
  const altIsMeta = isMetadataAltTitle(altTitle);
  const chaptersCount = Math.max(chapters.length, Number(item.totalEpisodes) || 0);
  const coverBackdropUrl = useResolvedCoverUrl(sourceId, item.cover);
  const countLabel = chaptersCount
    ? `${chaptersCount} ${chaptersCount === 1 ? presentation.unit : presentation.units}`
    : null;
  const heroFacts = [
    altIsMeta && altTitle ? altTitle : item.year,
    !altIsMeta && item.duration,
    mediaType !== "movie" ? countLabel : null,
    sourceId === "galaxynovels" && item.author ? `${t("details.authorLabel")}: ${item.author}` : null,
  ].filter(Boolean);
  const movieFactChips = buildMovieFactChips({
    year: item.year,
    duration: item.duration,
    audioLanguage,
    audioLabel: item.audioLabel,
  });
  const heroLayout = getDetailsHeroLayout({ isVideo, mediaType });
  const followPreference = chapterFollow?.getPreference(item);
  const isFollowing = Boolean(followPreference?.enabled);
  const canFollowUpdates = Boolean(chapterFollow) && isNotifiableMediaType(mediaType);
  const showChapterList = shouldShowChapterList(mediaType, chapters.length);
  const showChapterListSection = showChapterList || (status === "loading" && !isMoviePage);
  const showAbout = Boolean(item.summary) || categories.length > 0 || tags.length > 0;
  const showActionHubInDock = status === "ready" && !isMoviePage;
  const showMovieActionsInDock = status === "ready" && isMoviePage;
  const relatedItems = item.relatedItems || [];

  function resolveChapter(chapter) {
    return applyAudioLanguageToChapter(chapter, audioLanguage, sourceId);
  }

  function openChapter(chapter) {
    const resolved = resolveChapter(chapter);
    if (resolved.locked) window.open(resolved.url, "_blank", "noopener,noreferrer");
    else openLiveReader({ ...item, preferredAudioLanguage: audioLanguage }, resolved);
  }

  const detailsActionHub = (
    <DetailsActionHub
      mediaType={mediaType}
      latestChapter={latestChapter ? resolveChapter(latestChapter) : null}
      readingProgress={readingProgress}
      continueChapter={continueChapter}
      onOpenChapter={openChapter}
    />
  );

  const audioLanguagePicker = availableAudioLanguages.length > 0 ? (
    <AudioLanguagePicker
      className="details-audio-language--hero"
      languages={availableAudioLanguages}
      value={audioLanguage}
      onChange={setAudioLanguage}
    />
  ) : null;

  const heroCover = (
    <figure className="live-details-hero__cover">
      <RemoteCover
        src={item.cover}
        title={item.title}
        sourceId={sourceId}
        hero
        novel={isNovel}
        video={isVideo}
        contain={usesContainCover(sourceId)}
        priority
      />
      <CoverAudioBadge label={availableAudioLanguages.length ? audioLanguage : item.audioLabel} />
    </figure>
  );

  const heroMeta = (
    <DetailsHeroMeta
      isLoading={status === "loading"}
      mediaType={mediaType}
      typeLabel={typeLabel}
      publicationStatusKey={publicationStatusKey}
      publicationStatusLabel={publicationStatusLabel}
      title={item.title}
      altTitle={altTitle}
      showAltTitle={!altIsMeta}
      factChips={movieFactChips}
      factLine={heroFacts}
      useFactChips={isMoviePage}
      sourceId={sourceId}
      sourceName={profile.name}
    />
  );

  const heroActions = showMovieActionsInDock ? (
    <MovieWatchActions
      presentation={presentation}
      latestChapter={latestChapter ? resolveChapter(latestChapter) : null}
      continueChapter={continueChapter}
      readingProgress={readingProgress}
      audioLanguage={audioLanguage}
      onOpen={openChapter}
      audioPicker={audioLanguagePicker}
    />
  ) : (
    <>
      {showActionHubInDock && detailsActionHub}
      {status === "ready" && audioLanguagePicker}
    </>
  );

  const screenClassName = buildDetailsScreenClasses({
    isVideo,
    isNovel,
    isManga: !isVideo && !isNovel,
    isChromebookApp,
    isMoviePage,
    mediaType,
  });

  const heroClassName = buildDetailsHeroClasses({
    presentation,
    heroLayout,
    isLoading: status === "loading",
  });

  return (
    <>
    <div
      dir={dir}
      className={screenClassName}
    >
      <div className={heroClassName}>
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
            {canFollowUpdates && (
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
        <DetailsCinematicHero
          heroLayout={heroLayout}
          status={status}
          heroCover={heroCover}
          heroMeta={heroMeta}
          heroActions={heroActions}
        />
      </div>
      <main className={`content details-content${isMoviePage ? " details-content--movie" : ""}`}>
        {status === "loading" ? (
          <DetailsContentSkeleton
            label={presentation.loadingList}
            isMovie={isMoviePage}
            showSidebar={isVideo || isNovel || Boolean(seed.summary)}
            chapterCount={showChapterListSection ? 0 : (showChapterList ? 8 : 0)}
          />
        ) : status === "error" ? <div className="live-error"><Wifi size={30} /><h2>{t("details.loadDetailsFailed")}</h2><p>{error}</p><button className="button button--primary" onClick={loadDetails}><RefreshCw size={17} /> {t("common.retry")}</button></div> : <>
          {(showAbout || (isVideo && onOpenRelated)) && (
            <div className="details-sidebar">
          {showAbout && (
            <section className={`about details-about${summaryExpanded ? " expanded" : ""}`}>
              {item.summary ? (
                <>
                  <div className="details-section-heading">
                    <h2>{t("details.synopsis")}</h2>
                  </div>
                  <p dir="auto">{item.summary}</p>
                  {item.summary.length > 260 && (
                    <button
                      className="details-about__toggle"
                      onClick={() => setSummaryExpanded((expanded) => !expanded)}
                      aria-expanded={summaryExpanded}
                    >
                      {summaryExpanded ? <><ChevronUp size={15} /> {t("details.showLess")}</> : <><ChevronDown size={15} /> {t("details.showFullSynopsis")}</>}
                    </button>
                  )}
                </>
              ) : null}
              {(categories.length > 0 || tags.length > 0) && (
                <div className="details-about__tags">
                  {(taxonomiesExpanded ? categories : categories.slice(0, 8)).map((category) => (
                    <span className="details-taxonomy-chip details-taxonomy-chip--category" key={category}>{category}</span>
                  ))}
                  {(taxonomiesExpanded ? tags : tags.slice(0, 6)).map((tag) => (
                    <span className="details-taxonomy-chip" key={tag}>#{tag}</span>
                  ))}
                  {(categories.length > 8 || tags.length > 6) && (
                    <button
                      className="details-taxonomies__toggle"
                      onClick={() => setTaxonomiesExpanded((expanded) => !expanded)}
                      aria-expanded={taxonomiesExpanded}
                    >
                      {taxonomiesExpanded ? t("details.showLess") : t("details.showAll", { count: categories.length + tags.length })}
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
          {isVideo && onOpenRelated && (
            <RelatedMoviesRow
              items={relatedItems}
              onOpen={onOpenRelated}
              mediaType={mediaType}
              layout={isMoviePage ? "movie-strip" : "scroll"}
            />
          )}
            </div>
          )}
        </>}
        {showChapterListSection && status !== "error" && (
          <DetailsChapterSection
            status={status}
            isChromebookApp={isChromebookApp}
            presentation={presentation}
            chapters={chapters}
            filteredChapters={filteredChapters}
            pagedChapters={pagedChapters}
            chapterQuery={chapterQuery}
            onChapterQueryChange={setChapterQuery}
            chapterAuthors={chapterAuthors}
            chapterAuthor={chapterAuthor}
            onChapterAuthorChange={setChapterAuthor}
            chapterOrder={chapterOrder}
            onChapterOrderToggle={() => setChapterOrder((order) => (order === "desc" ? "asc" : "desc"))}
            chapterPage={chapterPage}
            onChapterPageChange={setChapterPage}
            totalChapterPages={totalChapterPages}
            chapterPageSize={chapterPageSize}
            latestChapter={latestChapter}
            isLatestChapterNew={isLatestChapterNew}
            sourceName={profile.name}
            audioLanguage={audioLanguage}
            onOpenChapter={openChapter}
          />
        )}
      </main>
    </div>
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
    </>
  );
}
