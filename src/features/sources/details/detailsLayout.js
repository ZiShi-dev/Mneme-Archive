/** Layout modes for the live details hero. */
export const DETAILS_HERO_LAYOUT = {
  READING: "reading",
  CINEMATIC_VIDEO: "cinematic-video",
};

export function isStandaloneVideoCatalogItem(item) {
  return item?.catalogStyle === "standalone";
}

export function isMovieMediaType(mediaType) {
  return mediaType === "movie";
}

/**
 * Reading layout (cover + meta side by side) for manga, novels, movies and standalone video feeds.
 * Cinematic stacked layout for series and anime catalogs with seasons.
 */
export function getDetailsHeroLayout({ isVideo, mediaType, catalogStyle, sourceId }) {
  if (!isVideo || isMovieMediaType(mediaType)) {
    return DETAILS_HERO_LAYOUT.READING;
  }
  if (catalogStyle === "standalone" || sourceId === "hentaigasm") {
    return DETAILS_HERO_LAYOUT.READING;
  }
  return DETAILS_HERO_LAYOUT.CINEMATIC_VIDEO;
}

export function buildMovieFactChips({ year, duration, audioLanguage, audioLabel }) {
  return [year, duration, audioLanguage || audioLabel].filter(Boolean);
}

export function buildDetailsScreenClasses({
  isVideo,
  isNovel,
  isManga,
  isChromebookApp,
  isMoviePage,
  mediaType,
  catalogStyle,
}) {
  const classes = ["screen", "screen--live-details"];
  if (isVideo) classes.push("screen--live-video", "screen--live-anime");
  if (isNovel) classes.push("screen--live-novel");
  if (isManga) classes.push("screen--live-manga");
  if (isChromebookApp) classes.push("screen--details-desktop");
  if (isMoviePage) classes.push("screen--details-movie");
  if (catalogStyle === "standalone") classes.push("screen--details-standalone-video");
  classes.push("screen--details-cinematic", `screen--details-cinematic-${mediaType}`);
  return classes.join(" ");
}

export function buildDetailsHeroClasses({ presentation, heroLayout, isLoading }) {
  const classes = ["live-details-hero", "live-details-hero--cinematic"];
  if (presentation.heroClass) classes.push(presentation.heroClass);
  if (heroLayout === DETAILS_HERO_LAYOUT.READING) classes.push("live-details-hero--reading");
  if (isLoading) classes.push("live-details-hero--loading");
  return classes.join(" ");
}

export function shouldShowChapterList(mediaType, chaptersLength) {
  return mediaType !== "movie" || chaptersLength !== 1;
}
