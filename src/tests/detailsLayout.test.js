import test from "node:test";
import assert from "node:assert/strict";
import {
  DETAILS_HERO_LAYOUT,
  buildDetailsHeroClasses,
  buildDetailsScreenClasses,
  buildMovieFactChips,
  getDetailsHeroLayout,
  shouldShowChapterList,
} from "../features/sources/details/detailsLayout.js";

test("getDetailsHeroLayout uses reading layout for manga, novel and movie", () => {
  assert.equal(getDetailsHeroLayout({ isVideo: false, mediaType: "manga" }), DETAILS_HERO_LAYOUT.READING);
  assert.equal(getDetailsHeroLayout({ isVideo: false, mediaType: "novel" }), DETAILS_HERO_LAYOUT.READING);
  assert.equal(getDetailsHeroLayout({ isVideo: true, mediaType: "movie" }), DETAILS_HERO_LAYOUT.READING);
});

test("getDetailsHeroLayout uses cinematic layout for series and anime", () => {
  assert.equal(getDetailsHeroLayout({ isVideo: true, mediaType: "series" }), DETAILS_HERO_LAYOUT.CINEMATIC_VIDEO);
  assert.equal(getDetailsHeroLayout({ isVideo: true, mediaType: "anime" }), DETAILS_HERO_LAYOUT.CINEMATIC_VIDEO);
});

test("buildMovieFactChips keeps year, duration and active audio", () => {
  assert.deepEqual(
    buildMovieFactChips({ year: "2026", duration: "2h", audioLanguage: "VOSTFR", audioLabel: "VF" }),
    ["2026", "2h", "VOSTFR"],
  );
});

test("buildDetailsScreenClasses adds movie and media modifiers", () => {
  const classes = buildDetailsScreenClasses({
    isVideo: true,
    isNovel: false,
    isManga: false,
    isChromebookApp: false,
    isMoviePage: true,
    mediaType: "movie",
  });
  assert.match(classes, /screen--details-movie/);
  assert.match(classes, /screen--details-cinematic-movie/);
});

test("buildDetailsHeroClasses marks reading hero state", () => {
  const classes = buildDetailsHeroClasses({
    presentation: { heroClass: "live-details-hero--video live-details-hero--movie" },
    heroLayout: DETAILS_HERO_LAYOUT.READING,
    isLoading: false,
  });
  assert.match(classes, /live-details-hero--reading/);
  assert.match(classes, /live-details-hero--movie/);
});

test("getDetailsHeroLayout uses reading layout for standalone anime feeds", () => {
  assert.equal(
    getDetailsHeroLayout({ isVideo: true, mediaType: "anime", catalogStyle: "standalone" }),
    DETAILS_HERO_LAYOUT.READING,
  );
});

test("buildDetailsScreenClasses adds standalone video modifier", () => {
  const classes = buildDetailsScreenClasses({
    isVideo: true,
    isNovel: false,
    isManga: false,
    isChromebookApp: false,
    isMoviePage: false,
    mediaType: "anime",
    catalogStyle: "standalone",
  });
  assert.match(classes, /screen--details-standalone-video/);
  assert.doesNotMatch(classes, /screen--source-/);
});

test("buildDetailsHeroClasses marks standalone video hero", () => {
  const classes = buildDetailsHeroClasses({
    presentation: { heroClass: "live-details-hero--video" },
    heroLayout: DETAILS_HERO_LAYOUT.READING,
    isLoading: false,
    standaloneVideo: true,
  });
  assert.match(classes, /live-details-hero--standalone-video/);
});

test("shouldShowChapterList hides single-chapter movies", () => {
  assert.equal(shouldShowChapterList("movie", 1), false);
  assert.equal(shouldShowChapterList("movie", 2), true);
  assert.equal(shouldShowChapterList("series", 1), true);
});
