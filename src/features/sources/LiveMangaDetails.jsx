import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bell, BellRing, Bookmark, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, Languages, RefreshCw, Wifi } from "lucide-react";
import { useToast } from "../../components/ui/ToastProvider";
import { getSourceProfile, resolveSourceId } from "../../config/sources";
import { isChromebookApp, isNotifiableMediaType, PREFERRED_AUDIO_LANGUAGE } from "../../config/appFlavor";
import { runAppPullRefresh } from "../../lib/platform/appRefresh";
import { fetchSourceDetails, fetchSourceChapter, formatSourceError, peekSourceDetails, peekSourceChapter } from "./sourceApi";
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
import { pickBestCover, usesContainCover } from "./coverDisplay";
import { CoverAudioBadge } from "./CatalogCard";
import { useResolvedCoverUrl } from "./useResolvedCoverUrl";
import { findChapterByRecord, getTitleReadingKey } from "../../lib/readingProgress";
import { listTitleChapterReads } from "../../lib/reading/chapterReadLog";
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
import { isAzoraChapterBlocked, isAzoraFlySource } from "../../lib/media/chapterLock";
import { VideoServerSheet } from "./liveVideo/VideoServerSheet";
import { formatUniqueServerLabels } from "./liveVideo/constants";
import { playbackSourcesFromChapterData } from "./liveVideo/videoPlaybackCache";
import { resolveVideoDetailsChapterPageSize } from "./videoCatalog";
import { detailsHasImmediateChapters } from "./details/detailsSeed";
import { PullToRefreshIndicator } from "../../components/ui/PullToRefreshIndicator";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { isNativeMobileApp } from "../../lib/platform/nativeAppLayout";
import { liveReaderPrefetchOptions, prefetchReaderChapter } from "../../lib/reading/readerChapterCache.js";

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
    <div className={`details-audio-language ${className}`.trim()}>
      <div className="details-audio-language__head">
        <Languages size={16} strokeWidth={2} aria-hidden="true" />
        <span className="details-audio-language__label">{t("details.audioVersion")}</span>
      </div>
      <div
        className="details-audio-toggle"
        role="group"
        aria-label={t("details.audioVersionAria")}
        style={{ "--audio-toggle-count": languages.length }}
      >
        {languages.map((language) => (
          <button
            key={language}
            type="button"
            className={`details-audio-toggle__option${value === language ? " is-active" : ""}`}
            aria-pressed={value === language}
            onClick={() => onChange(language)}
          >
            {AUDIO_LANGUAGE_LABELS[language] || language}
          </button>
        ))}
      </div>
    </div>
  );
}

function normalizeTaxonomy(value) {
  const entries = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,،]/) : [];
  return [...new Set(entries.map((entry) => (typeof entry === "string" ? entry : String(entry?.name || entry?.label || "")).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim()).filter(Boolean))];
}

function RelatedMoviesRow({ items, onOpen, mediaType, layout = "scroll" }) {
  const { t, dir } = useI18n();
  const scrollerRef = useRef(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  if (!items.length) return null;
  const isSeries = mediaType === "series";
  const isSeasonsCarousel = layout === "seasons-carousel";
  const rtl = dir === "rtl";
  const PreviousIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;

  const updateScrollState = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const maxScroll = node.scrollWidth - node.clientWidth;
    setCanScrollBack(node.scrollLeft > 4);
    setCanScrollForward(maxScroll > 4 && node.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const node = scrollerRef.current;
    if (!node) return undefined;
    node.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollState) : null;
    observer?.observe(node);
    return () => {
      node.removeEventListener("scroll", updateScrollState);
      observer?.disconnect();
    };
  }, [items, updateScrollState]);

  function scrollSeasons(direction) {
    const node = scrollerRef.current;
    if (!node) return;
    const step = Math.max(200, Math.round(node.clientWidth * 0.82));
    node.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <section className={`details-related details-related--${layout}`} aria-labelledby="details-related-title">
      <div className={`details-related__head${isSeasonsCarousel ? " details-related__head--carousel" : ""}`}>
        <div className="details-section-heading">
          <h2 id="details-related-title">{isSeries ? t("details.otherSeasons") : t("details.relatedMovies")}</h2>
        </div>
        {isSeasonsCarousel ? (
          <div className="details-related__nav" aria-hidden={!canScrollBack && !canScrollForward}>
            <button
              type="button"
              className="details-related__nav-btn"
              onClick={() => scrollSeasons(-1)}
              disabled={!canScrollBack}
              aria-label={t("common.previous")}
            >
              <PreviousIcon size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="details-related__nav-btn"
              onClick={() => scrollSeasons(1)}
              disabled={!canScrollForward}
              aria-label={t("common.next")}
            >
              <NextIcon size={18} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
      <div className="details-related__scroller" ref={scrollerRef}>
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
  chapterReadLog = {},
}) {
  const { pushToast } = useToast();
  const { t, dir } = useI18n();
  const sourceId = resolveSourceId(seed);
  const profile = getSourceProfile(sourceId);
  const [item, setItem] = useState(() => seed);
  const [status, setStatus] = useState(() => (
    detailsHasImmediateChapters(seed, peekSourceDetails(sourceId, seed.url, seed)) ? "ready" : "loading"
  ));
  const [error, setError] = useState("");
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [taxonomiesExpanded, setTaxonomiesExpanded] = useState(false);
  const [chapterQuery, setChapterQuery] = useState("");
  const [chapterAuthor, setChapterAuthor] = useState("");
  const [chapterOrder, setChapterOrder] = useState("desc");
  const [chapterPage, setChapterPage] = useState(1);
  const [followSheetOpen, setFollowSheetOpen] = useState(false);
  const [serverPicker, setServerPicker] = useState(null);
  const [audioLanguage, setAudioLanguage] = useState(PREFERRED_AUDIO_LANGUAGE);
  const [progressRefresh, setProgressRefresh] = useState(0);
  const loadGeneration = useRef(0);
  const serverPickerRequest = useRef(0);
  const screenRef = useRef(null);

  useEffect(() => {
    const bump = () => setProgressRefresh((tick) => tick + 1);
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, []);

  const loadDetails = useCallback(async () => {
    const generation = ++loadGeneration.current;
      const cached = peekSourceDetails(sourceId, seed.url, seed);
      if (cached) {
      setItem({
        ...seed,
        ...cached,
        cover: pickBestCover(cached.cover, seed.cover),
        catalogStyle: cached.catalogStyle || seed.catalogStyle,
        chapters: cached.chapters?.length ? normalizeChapterList(cached.chapters) : cached.chapters,
      });
      setStatus("ready");
    } else {
      setItem(seed);
      setStatus("loading");
    }
    setError("");
    try {
      const data = await fetchSourceDetails(sourceId, seed.url, seed);
      if (generation !== loadGeneration.current) return;
      setItem({
        ...seed,
        ...data,
        cover: pickBestCover(data.cover, seed.cover),
        catalogStyle: data.catalogStyle || seed.catalogStyle,
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

  const handlePullRefresh = useCallback(async () => {
    await runAppPullRefresh();
    await loadDetails();
  }, [loadDetails]);

  const {
    pullDistance: detailsPullDistance,
    refreshing: detailsRefreshing,
    threshold: detailsPullThreshold,
  } = usePullToRefresh({
    scrollerRef: screenRef,
    onRefresh: handlePullRefresh,
    enabled: isNativeMobileApp(),
  });

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
  const chapterReadEntries = useMemo(() => {
    void progressRefresh;
    return listTitleChapterReads(chapterReadLog, getTitleReadingKey(item), readingProgress);
  }, [chapterReadLog, item, readingProgress, progressRefresh]);
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
    const matches = normalized
      ? chapters.filter((chapter) => `${chapter.number || ""} ${chapter.name || ""}`.toLowerCase().includes(normalized))
      : chapters;
    const byAuthor = chapterAuthor
      ? matches.filter((chapter) => (chapter.author || item.author || "") === chapterAuthor)
      : matches;
    const sorted = [...byAuthor].sort((a, b) => {
      const diff = chapterSortKey(b) - chapterSortKey(a);
      if (diff !== 0) return diff;
      return String(b.url || "").localeCompare(String(a.url || ""), undefined, { numeric: true });
    });
    return chapterOrder === "desc" ? sorted : sorted.slice().reverse();
  }, [chapterAuthor, chapterOrder, chapterQuery, chapters, item.author]);

  useEffect(() => setChapterPage(1), [chapterAuthor, chapterOrder, chapterQuery]);
  useEffect(() => {
    if (!chapterAuthors.length) {
      setChapterAuthor("");
      return;
    }
    setChapterAuthor((current) => (current && chapterAuthors.includes(current) ? current : chapterAuthors[0]));
  }, [chapterAuthors, seed.url]);

  const mediaType = resolveBookmarkType(item);
  const isMoviePage = isMovieMediaType(mediaType);
  const presentation = getMediaPresentation(mediaType);
  const isNovel = presentation.isNovel;
  const isVideo = presentation.isVideo;
  const resolvedChapterPageSize = resolveVideoDetailsChapterPageSize(sourceId, mediaType, chapterPageSize);
  const totalChapterPages = Math.max(1, Math.ceil(filteredChapters.length / resolvedChapterPageSize));
  const pagedChapters = filteredChapters.slice((chapterPage - 1) * resolvedChapterPageSize, chapterPage * resolvedChapterPageSize);

  useEffect(() => { if (chapterPage > totalChapterPages) setChapterPage(totalChapterPages); }, [chapterPage, totalChapterPages]);

  const continueChapter = useMemo(() => {
    const raw = findChapterByRecord(chapters, readingProgress);
    return raw ? applyAudioLanguageToChapter(raw, audioLanguage, sourceId) : null;
  }, [audioLanguage, chapters, readingProgress, sourceId]);
  const firstChapter = useMemo(() => {
    const unlocked = chapters.filter((chapter) => !chapter.locked);
    const pool = unlocked.length ? unlocked : chapters;
    if (!pool.length) return null;
    return [...pool].sort((a, b) => {
      const diff = chapterSortKey(a) - chapterSortKey(b);
      if (diff !== 0) return diff;
      return String(a.url || "").localeCompare(String(b.url || ""), undefined, { numeric: true });
    })[0];
  }, [chapters]);
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
  const chaptersCount = status === "ready"
    ? Math.max(chapters.length, Number(item.totalEpisodes) || 0)
    : 0;
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
  const isStandaloneVideo = item.catalogStyle === "standalone";
  const heroLayout = getDetailsHeroLayout({
    isVideo,
    mediaType,
    catalogStyle: item.catalogStyle,
    sourceId,
  });
  const followPreference = chapterFollow?.getPreference(item);
  const isFollowing = Boolean(followPreference?.enabled);
  const canFollowUpdates = Boolean(chapterFollow) && isNotifiableMediaType(mediaType);
  const showChapterList = shouldShowChapterList(mediaType, chapters.length);
  const showChapterListSection = showChapterList || (status === "loading" && !isMoviePage);
  const showAbout = Boolean(item.summary) || categories.length > 0 || tags.length > 0;
  const showActionHubInDock = status === "ready" && !isMoviePage;
  const showMovieActionsInDock = status === "ready" && isMoviePage;
  const relatedItems = item.relatedItems || [];
  const isSeriesPage = mediaType === "series";
  const showRelatedMoviesInSidebar = isVideo && onOpenRelated && isMoviePage && relatedItems.length > 0;
  const showRelatedSeasonsRow = isVideo && onOpenRelated && isSeriesPage && relatedItems.length > 0;

  function resolveChapter(chapter) {
    return applyAudioLanguageToChapter(chapter, audioLanguage, sourceId);
  }

  function chapterFetchOptions(chapter) {
    return {
      contentApi: chapter?.contentApi,
      language: chapter?.preferredAudioLanguage || audioLanguage || "",
    };
  }

  useEffect(() => {
    if (!isVideo) return undefined;
    import("./LiveVideoPlayer");
    return undefined;
  }, [isVideo]);

  useEffect(() => {
    const target = continueChapter || firstChapter;
    if (!target?.url) return undefined;
    const resolved = resolveChapter(target);
    const opts = chapterFetchOptions(resolved);
    if (peekSourceChapter(sourceId, resolved.url, opts)) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) fetchSourceChapter(sourceId, resolved.url, opts).catch(() => {});
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [audioLanguage, continueChapter?.url, firstChapter?.url, sourceId]);

  function prefetchChapter(chapter) {
    const resolved = resolveChapter(chapter);
    if (isAzoraChapterBlocked(sourceId, resolved) || resolved.locked) return;
    prefetchReaderChapter(sourceId, resolved, { ...item, preferredAudioLanguage: audioLanguage }, chapterFetchOptions(resolved));
  }

  function openChapter(chapter) {
    const resolved = resolveChapter(chapter);
    if (isAzoraChapterBlocked(sourceId, resolved)) return;
    if (resolved.locked && !isAzoraFlySource(sourceId) && sourceId !== "realmnovel") {
      window.open(resolved.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!isVideo) {
      openLiveReader(
        { ...item, preferredAudioLanguage: audioLanguage },
        resolved,
        liveReaderPrefetchOptions({ ...item, sourceId }, resolved),
      );
      return;
    }

    const requestId = serverPickerRequest.current + 1;
    serverPickerRequest.current = requestId;
    const opts = chapterFetchOptions(resolved);
    const cached = peekSourceChapter(sourceId, resolved.url, opts);
    const cachedSources = playbackSourcesFromChapterData(cached);
    if (cachedSources.length) {
      setServerPicker({
        chapter: resolved,
        loading: false,
        sources: cachedSources,
        data: cached,
      });
      return;
    }

    setServerPicker({ chapter: resolved, loading: true, sources: [], data: null });

    fetchSourceChapter(sourceId, resolved.url, opts)
      .then((result) => {
        if (serverPickerRequest.current !== requestId) return;
        const sources = playbackSourcesFromChapterData(result);
        if (!sources.length) {
          setServerPicker(null);
          openLiveReader({ ...item, preferredAudioLanguage: audioLanguage }, resolved, {
            prefetchData: { ...result, url: resolved.url },
          });
          return;
        }
        setServerPicker({
          chapter: resolved,
          loading: false,
          sources,
          data: result,
        });
      })
      .catch((reason) => {
        if (serverPickerRequest.current !== requestId) return;
        setServerPicker(null);
        const message = formatSourceError(reason, presentation.loadError);
        pushToast({ type: "error", message });
      });
  }

  function closeServerPicker() {
    serverPickerRequest.current += 1;
    setServerPicker(null);
  }

  function enterVideoWithServer(index) {
    if (!serverPicker?.chapter) return;
    const chapter = serverPicker.chapter;
    const prefetchData = serverPicker.data
      ? { ...serverPicker.data, url: chapter.url }
      : null;
    closeServerPicker();
    openLiveReader({ ...item, preferredAudioLanguage: audioLanguage }, chapter, {
      preferredSourceIndex: index,
      prefetchData,
    });
  }

  const detailsActionHub = (
    <DetailsActionHub
      sourceId={sourceId}
      mediaType={mediaType}
      firstChapter={firstChapter ? resolveChapter(firstChapter) : null}
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
    catalogStyle: item.catalogStyle,
    sourceId,
  });

  const heroClassName = buildDetailsHeroClasses({
    presentation,
    heroLayout,
    isLoading: status === "loading",
    standaloneVideo: isStandaloneVideo,
  });

  return (
    <>
    <PullToRefreshIndicator
      pullDistance={detailsPullDistance}
      refreshing={detailsRefreshing}
      threshold={detailsPullThreshold}
    />
    <div
      ref={screenRef}
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
          standaloneVideo={isStandaloneVideo}
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
          {(showAbout || showRelatedMoviesInSidebar) && (
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
          {showRelatedMoviesInSidebar && (
            <RelatedMoviesRow
              items={relatedItems}
              onOpen={onOpenRelated}
              mediaType={mediaType}
              layout="movie-strip"
            />
          )}
            </div>
          )}
          {showRelatedSeasonsRow && (
            <RelatedMoviesRow
              items={relatedItems}
              onOpen={onOpenRelated}
              mediaType={mediaType}
              layout="seasons-carousel"
            />
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
            chapterPageSize={resolvedChapterPageSize}
            latestChapter={latestChapter}
            isLatestChapterNew={isLatestChapterNew}
            sourceId={sourceId}
            sourceName={profile.name}
            audioLanguage={audioLanguage}
            onOpenChapter={openChapter}
            onPrefetchChapter={prefetchChapter}
            chapterReadEntries={chapterReadEntries}
          />
        )}
      </main>
    </div>
      {serverPicker ? (
        <VideoServerSheet
          open
          loading={serverPicker.loading}
          serverLabels={formatUniqueServerLabels(serverPicker.sources, t)}
          activeIndex={-1}
          onClose={closeServerPicker}
          onSelect={enterVideoWithServer}
        />
      ) : null}
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
