import { t } from "../../i18n/runtime.js";

export function isVideoMediaType(mediaType) {
  const type = String(mediaType || "").toLowerCase();
  return type === "anime" || type === "movie" || type === "series";
}

export function getMediaPresentation(mediaType) {
  const type = String(mediaType || "manga").toLowerCase();
  const badgeLabel = t(`media.${type}`) || t("media.manga");

  if (isVideoMediaType(type)) {
    const isMovie = type === "movie";
    return {
      type,
      isVideo: true,
      isNovel: false,
      badgeLabel: isMovie ? t("media.movie") : badgeLabel,
      unit: isMovie ? t("media.movie") : t("media.episode"),
      units: isMovie ? t("media.movies") : t("media.episodes"),
      sectionTitle: isMovie ? t("media.theMovie") : t("media.theEpisodes"),
      searchPlaceholder: isMovie ? t("media.searchMovie") : t("media.searchEpisode"),
      loadingList: isMovie ? t("media.loadingMovie") : t("media.loadingEpisodes"),
      emptyList: isMovie ? t("media.emptyMovie") : t("media.emptyEpisodes"),
      noMatch: isMovie ? t("media.noMovie") : t("media.noEpisode"),
      paginationAria: isMovie ? t("media.pagesMovies") : t("media.pagesEpisodes"),
      continueAction: t("media.continueWatch"),
      watchedToday: t("media.watchedToday"),
      lastUnitComplete: isMovie ? t("media.lastMovieDone") : t("media.lastEpisodeDone"),
      watchLatest: isMovie ? t("media.watchMovie") : t("media.watchEpisode"),
      watchFromLatest: t("media.fromLatest"),
      orWatchLatest: t("media.orFromLatest"),
      latestStat: t("media.latest"),
      unitsStat: isMovie ? t("media.theMovies") : t("media.theEpisodes"),
      openAria: (name) => isMovie ? t("media.watchMovieNamed", { name }) : t("media.watchEpisodeNamed", { name }),
      lockedAria: (name) => isMovie ? t("media.paidMovie", { name }) : t("media.paidEpisode", { name }),
      rowPrefix: isMovie ? t("media.theMovie") : t("media.theEpisode"),
      headerUnit: isMovie ? t("media.theMovie") : t("media.theEpisode"),
      endMarker: isMovie ? t("media.endMovie") : t("media.endEpisode"),
      loadingContent: isMovie ? t("media.loadingMovie") : t("media.loadingEpisode"),
      loadError: isMovie ? t("media.loadMovieFailed") : t("media.loadEpisodeFailed"),
      heroClass: isMovie ? "live-details-hero--video live-details-hero--movie" : "live-details-hero--video",
      completeToast: isMovie ? t("media.movieDone") : t("media.episodeDone"),
    };
  }

  if (type === "novel") {
    return {
      type,
      isVideo: false,
      isNovel: true,
      badgeLabel,
      unit: t("media.chapter"),
      units: t("media.chapters"),
      sectionTitle: t("media.theChapters"),
      searchPlaceholder: t("media.searchChapter"),
      loadingList: t("media.loadingChapters"),
      emptyList: t("media.emptyChapters"),
      noMatch: t("media.noChapter"),
      paginationAria: t("media.pagesChapters"),
      continueAction: t("media.continueRead"),
      watchedToday: t("media.readToday"),
      lastUnitComplete: t("media.lastChapterDone"),
      watchLatest: t("media.readChapter"),
      watchFromLatest: t("media.fromLatest"),
      orWatchLatest: t("media.orFromLatest"),
      latestStat: t("media.latest"),
      unitsStat: t("media.theChapters"),
      openAria: (name) => t("media.openChapterNamed", { name }),
      lockedAria: (name) => t("media.paidChapter", { name }),
      rowPrefix: t("media.theChapter"),
      headerUnit: t("media.theChapter"),
      endMarker: t("media.endChapter"),
      loadingContent: t("media.loadingChapter"),
      loadError: t("media.loadChapterFailed"),
      heroClass: "live-details-hero--novel",
      completeToast: t("media.chapterDone"),
    };
  }

  return {
    type: "manga",
    isVideo: false,
    isNovel: false,
    badgeLabel: t("media.manga"),
    unit: t("media.chapter"),
    units: t("media.chapters"),
    sectionTitle: t("media.theChapters"),
    searchPlaceholder: t("media.searchChapter"),
    loadingList: t("media.loadingChapters"),
    emptyList: t("media.emptyChapters"),
    noMatch: t("media.noChapter"),
    paginationAria: t("media.pagesChapters"),
    continueAction: t("media.continueRead"),
    watchedToday: t("media.readToday"),
    lastUnitComplete: t("media.lastChapterDone"),
    watchLatest: t("media.readChapter"),
    watchFromLatest: t("media.fromLatest"),
    orWatchLatest: t("media.orFromLatest"),
    latestStat: t("media.latest"),
    unitsStat: t("media.theChapters"),
    openAria: (name) => t("media.openChapterNamed", { name }),
    lockedAria: (name) => t("media.paidChapter", { name }),
    rowPrefix: t("media.theChapter"),
    headerUnit: t("media.theChapter"),
    endMarker: t("media.endChapter"),
    loadingContent: t("media.loadingChapter"),
    loadError: t("media.loadChapterFailed"),
    heroClass: "",
    completeToast: t("media.chapterDone"),
  };
}

export function formatEpisodeHeaderLabel(chapterName, unitLabel = "") {
  const name = String(chapterName || "").trim();
  const unit = String(unitLabel || t("media.theEpisode")).trim();
  if (!name) return unit;
  if (new RegExp(`^${unit}\\s+`, "i").test(name)) return name;
  return `${unit} ${name}`;
}

export function resolveVideoPlayback(data) {
  if (!data) return null;

  const streamSources = Array.isArray(data.sources)
    ? data.sources.filter((entry) => entry?.streamUrl)
    : [];
  if (streamSources.length > 0) {
    const source = streamSources[0];
    return {
      mode: "hls",
      url: source.streamUrl,
      referer: source.streamReferer || data.streamReferer || data.url || "",
    };
  }

  const stream = data.videoUrl || data.streamUrl;
  if (stream && /^https?:\/\//i.test(String(stream))) {
    const url = String(stream);
    const isHls = data.playbackMode === "hls" || /\.m3u8|mpegurl/i.test(url);
    return {
      mode: isHls ? "hls" : "video",
      url,
      referer: data.streamReferer || data.url || "",
    };
  }
  if (data.embedUrl) return { mode: "embed", url: data.embedUrl };
  const candidates = [
    data.sources?.[0]?.streamUrl,
    data.sources?.[0]?.url,
    data.sources?.[0]?.src,
  ].filter(Boolean);
  const direct = candidates.find((entry) => isDirectPlaybackUrl(entry));
  if (direct) return { mode: "video", url: String(direct) };
  return null;
}

function isDirectPlaybackUrl(url = "") {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (/\.html?(?:$|[?#])/i.test(parsed.pathname)) return false;
    return /\.m3u8|\.mp4|\/embed|\/e\/|\/v\//i.test(`${parsed.pathname}${parsed.search}`);
  } catch {
    return false;
  }
}
