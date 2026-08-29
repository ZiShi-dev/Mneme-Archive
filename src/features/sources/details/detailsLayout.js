/** Layout modes for the live details hero. */
export const DETAILS_HERO_LAYOUT = {
  READING: "reading",
  CINEMATIC_VIDEO: "cinematic-video",
};

export function isMovieMediaType(mediaType) {
  return mediaType === "movie";
}

/**
 * Reading layout (cover + meta side by side) for manga, novels and movies.
 * Cinematic stacked layout for series and anime.
 */
export function getDetailsHeroLayout({ isVideo, mediaType }) {
  if (!isVideo || isMovieMediaType(mediaType)) {
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
}) {
  const classes = ["screen", "screen--live-details"];
  if (isVideo) classes.push("screen--live-video", "screen--live-anime");
  if (isNovel) classes.push("screen--live-novel");
  if (isManga) classes.push("screen--live-manga");
  if (isChromebookApp) classes.push("screen--details-desktop");
  if (isMoviePage) classes.push("screen--details-movie");
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
