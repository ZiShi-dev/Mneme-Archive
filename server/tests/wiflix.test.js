import test from "node:test";
import assert from "node:assert/strict";
import {
  assertChapterUrl,
  assertFilterPath,
  assertWatchUrl,
  assertWiflixStreamReferer,
  catalogHasMore,
  episodeNumberFromUrl,
  normalizeWiflixAudioLabel,
  normalizeWiflixUrl,
  parseWiflixCatalog,
  parseWiflixDetails,
  parseWiflixEpisodes,
  parseWiflixFilters,
  parseWiflixPlayback,
  parseWiflixPlayers,
  pickRelatedWiflixItems,
  rankWiflixSearch,
  relatedWiflixSearchQuery,
  wiflixSearchScore,
  wiflixSearchVariants,
} from "../sources/wiflix.js";

const FILM_CARD = `
<div class="mov clearfix">
  <div class="mov-i img-box aaa">
    <img src="/poster/the-last-sunrise.jpg" alt="The Last Sunrise">
    <div class="mov-mask flex-col ps-link" data-link="/watch/the-last-sunrise"><span class="fa fa-play"></span></div>
    <div class="mov-l">VF+VOSTFR</div>
    <div class="mov-m">3.9</div>
  </div>
  <a class="mov-t nowrap" href="/watch/the-last-sunrise">The Last Sunrise</a>
  <div class="nbloc1-2"><span class="nbloc1">2026</span></div>
</div>
`;

const SERIES_CARD = `
<div class="mov clearfix">
  <div class="mov-i img-box aaa">
    <img src="/poster/women-in-blue-saison-2.jpg" alt="Women In Blue - Saison 2">
    <div class="mov-mask flex-col ps-link" data-link="/watch/women-in-blue-saison-2"><span class="fa fa-play"></span></div>
    <div class="mov-l">2024</div>
    <div class="mov-m">4.6</div>
  </div>
  <a class="mov-t nowrap" href="/watch/women-in-blue-saison-2">Women In Blue - Saison 2</a>
  <div class="nbloc1-2"><span class="block-sai">Saison 2</span></div>
  <div class="block-ep"> Episode 3</div>
</div>
`;

const DETAILS_HTML = `
<title>Wiflix: Jack Reacher (2012) en streaming complet</title>
<h1 itemprop="name">Jack Reacher</h1>
<img itemprop="thumbnailUrl" id="posterimg" src="/poster/jack-reacher-film-streaming-complet-vf.jpg" alt="Jack Reacher">
<ul class="mov-list">
  <li><div class="mov-label">titre original:</div><div class="mov-desc">Jack Reacher</div></li>
  <li><div class="mov-label">Date de sortie:</div><div class="mov-desc"><a href="/annee/2012">2012</a></div></li>
  <li>
    <div class="mov-label">GENRE:</div>
    <div class="mov-desc">
      <a href="/genre/crime">Crime</a>
      <a href="/genre/drame">Drame</a>
      <a href="/genre/action">Action</a>
    </div>
  </li>
</ul>
<div class="screenshots-full">
  <h3 class="synop">Synopsis:</h3>
  Résumé du film Jack Reacher en Streaming Complet: Lentement, méticuleusement, un sniper arme un fusil.
</div>
<a data-src="https://96ar.com/e/bzoyawt79xkz" class="server-item"><span class="current">Filmoon</span></a>
<div class="version-option" data-version="TRUEFRENCH" data-url="https://96ar.com/e/bzoyawt79xkz">TRUEFRENCH</div>
<a data-src="https://uqload.net/embed-inh4wma7x0c6.html" class="server-item"><span>Uqload</span></a>
<div class="version-option" data-version="TRUEFRENCH" data-url="https://uqload.net/embed-inh4wma7x0c6.html">TRUEFRENCH</div>
`;

const SERIES_DETAILS_HTML = `
<title>Wiflix: Reacher Saison 1 en streaming complet</title>
<h1 itemprop="name">Reacher - Saison 1</h1>
<img id="posterimg" src="/poster/reacher-saison-1.jpg" alt="Reacher - Saison 1">
<ul class="mov-list">
  <li><div class="mov-label">titre original:</div><div class="mov-desc">Reacher</div></li>
  <li>
    <div class="mov-label">GENRE:</div>
    <div class="mov-desc">
      <a href="/genre/action-&-adventure">Action & Adventure</a>
      <a href="/genre/crime">Crime</a>
    </div>
  </li>
</ul>
<div class="screenshots-full">
  <h3 class="synop">Synopsis:</h3>
  Résumé du film Reacher - Saison 1 en Streaming Complet: Basé sur Killing Floor.
</div>
<div class="blocvostfr">
  <span class="stitle">VOSTFR</span>
  <ul class="eplist">
    <a href="/watch/reacher-saison-1?language=VOSTFR&episode=1"><li>Episode 1</li></a>
    <a href="/watch/reacher-saison-1?language=VOSTFR&episode=2"><li>Episode 2</li></a>
  </ul>
</div>
<div class="blocfr">
  <span class="stitle">VF</span>
  <ul class="eplist">
    <a href="/watch/reacher-saison-1?language=VF&episode=1"><li>Episode 1</li></a>
    <a href="/watch/reacher-saison-1?language=VF&episode=2"><li>Episode 2</li></a>
  </ul>
</div>
<iframe id="x_player_wfx" src="https://uqload.net/embed-lbs35sh8mjf6.html"></iframe>
<a data-src="https://uqload.net/embed-lbs35sh8mjf6.html" class="server-item"><span class="active">UQLOAD</span></a>
<a data-src="https://96ar.com/e/innzgmswd4f4" class="server-item"><span>NETU</span></a>
<a data-src="https://sandratableother.com/e/tiqqkzxpghgm" class="server-item"><span>VOE</span></a>
`;

const FILTERS_HTML = `
<a href="/genre/action/">Action</a>
<a href="/genre/comedie/">Comédie</a>
<a href="/annee/2026/">2026</a>
<a href="/annee/2025/">2025</a>
<span class="navigation">
  <span>1</span>
  <a href="/film-en-streaming?page=2">2</a>
</span>
`;

test("assertWiflixStreamReferer accepts wiflix pages only", () => {
  assert.equal(
    assertWiflixStreamReferer("https://www.wiflix.tv/watch/jack-reacher-film-streaming-complet-vf"),
    "https://www.wiflix.tv/watch/jack-reacher-film-streaming-complet-vf",
  );
  assert.throws(
    () => assertWiflixStreamReferer("https://evil.example/watch/jack"),
    /غير صالح/,
  );
});

test("normalizeWiflixUrl keeps watch links on wiflix.tv", () => {
  assert.equal(
    normalizeWiflixUrl("https://wiflix.tv/watch/jack-reacher-film-streaming-complet-vf"),
    "https://www.wiflix.tv/watch/jack-reacher-film-streaming-complet-vf",
  );
  assert.equal(normalizeWiflixUrl("https://evil.example/watch/jack-reacher"), "");
});

test("assertWatchUrl rejects non-watch paths", () => {
  assert.equal(
    assertWatchUrl("https://www.wiflix.tv/watch/reacher-saison-1?language=VF&episode=1"),
    "https://www.wiflix.tv/watch/reacher-saison-1",
  );
  assert.throws(() => assertWatchUrl("https://www.wiflix.tv/film-en-streaming/"));
  assert.throws(() => assertWatchUrl("https://evil.example/watch/reacher-saison-1"));
});

test("assertChapterUrl keeps VF episode query", () => {
  assert.equal(
    assertChapterUrl("https://www.wiflix.tv/watch/reacher-saison-1?language=VF&episode=3"),
    "https://www.wiflix.tv/watch/reacher-saison-1?language=VF&episode=3",
  );
  assert.equal(episodeNumberFromUrl("https://www.wiflix.tv/watch/reacher-saison-1?language=VOSTFR&episode=8"), "8");
});

test("assertFilterPath allows mixed, catalogs, genres and years", () => {
  assert.equal(assertFilterPath("/all/"), "/all/");
  assert.equal(assertFilterPath("/film-en-streaming"), "/film-en-streaming/");
  assert.equal(assertFilterPath("/genre/action-&-adventure"), "/genre/action-&-adventure/");
  assert.equal(assertFilterPath("/annee/2026"), "/annee/2026/");
  assert.throws(() => assertFilterPath("/watch/reacher-saison-1"));
  assert.throws(() => assertFilterPath("https://www.wiflix.tv/film-en-streaming/"));
});

test("parseWiflixCatalog reads films and series", () => {
  const items = parseWiflixCatalog(FILM_CARD + SERIES_CARD);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "The Last Sunrise");
  assert.equal(items[0].id, "the-last-sunrise");
  assert.equal(items[0].mediaType, "movie");
  assert.equal(items[0].audioLabel, "VF+VOSTFR");
  assert.equal(items[0].year, "2026");
  assert.equal(items[0].latestChapter, "1");
  assert.equal(items[0].cover, "https://www.wiflix.tv/poster/the-last-sunrise.jpg");
  assert.equal(items[1].title, "Women In Blue - Saison 2");
  assert.equal(items[1].mediaType, "series");
  assert.equal(items[1].latestChapter, "3");
  assert.match(items[1].latestChapterUrl, /language=VF&episode=3/);
});

test("normalizeWiflixAudioLabel maps TrueFrench to VF", () => {
  assert.equal(normalizeWiflixAudioLabel("VF"), "VF");
  assert.equal(normalizeWiflixAudioLabel("VOSTFR"), "VOSTFR");
  assert.equal(normalizeWiflixAudioLabel("VF+VOSTFR"), "VF+VOSTFR");
  assert.equal(normalizeWiflixAudioLabel("TrueFrench"), "VF");
  assert.equal(normalizeWiflixAudioLabel("French"), "VF");
  assert.equal(normalizeWiflixAudioLabel("2024"), "");
});

test("catalogHasMore reads page query links", () => {
  assert.equal(catalogHasMore(FILTERS_HTML, 1), true);
  assert.equal(catalogHasMore(FILTERS_HTML, 2), false);
});

test("parseWiflixFilters reads genres and years", () => {
  const filters = parseWiflixFilters(FILTERS_HTML);
  assert.deepEqual(filters.categories.map((entry) => entry.slug), ["action", "comedie"]);
  assert.equal(filters.categories[0].filterPath, "/genre/action/");
  assert.deepEqual(filters.tags.map((entry) => entry.slug), ["2026", "2025"]);
});

test("parseWiflixDetails reads poster, year, genres and synopsis", () => {
  const details = parseWiflixDetails(DETAILS_HTML, "https://www.wiflix.tv/watch/jack-reacher-film-streaming-complet-vf");
  assert.equal(details.title, "Jack Reacher");
  assert.equal(details.cover, "https://www.wiflix.tv/poster/jack-reacher-film-streaming-complet-vf.jpg");
  assert.equal(details.year, "2012");
  assert.deepEqual(details.categories, ["Crime", "Drame", "Action"]);
  assert.match(details.summary, /sniper/);
  assert.equal(details.mediaType, "movie");
  assert.equal(details.audioLabel, "VF");
  assert.equal(details.chapters.length, 1);
});

test("parseWiflixEpisodes prefers VF when both languages exist", () => {
  const chapters = parseWiflixEpisodes(SERIES_DETAILS_HTML, "https://www.wiflix.tv/watch/reacher-saison-1");
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "1");
  assert.match(chapters[0].url, /language=VF&episode=1/);
  assert.match(chapters[1].url, /language=VF&episode=2/);
  assert.equal(chapters[0].audioLanguages.VF, chapters[0].url);
  assert.match(chapters[0].audioLanguages.VOSTFR, /language=VOSTFR&episode=1/);
});

test("parseWiflixDetails reads series genres and episodes", () => {
  const details = parseWiflixDetails(SERIES_DETAILS_HTML, "https://www.wiflix.tv/watch/reacher-saison-1");
  assert.equal(details.mediaType, "series");
  assert.equal(details.audioLabel, "VF+VOSTFR");
  assert.equal(details.totalEpisodes, 2);
  assert.deepEqual(details.categories, ["Action & Adventure", "Crime"]);
});

test("parseWiflixPlayers extracts Filmoon and Uqload", () => {
  const players = parseWiflixPlayers(DETAILS_HTML);
  assert.equal(players.length, 2);
  assert.equal(players[0].url, "https://uqload.net/embed-inh4wma7x0c6.html");
  assert.equal(players[0].label, "Uqload");
  assert.equal(players[1].url, "https://96ar.com/e/bzoyawt79xkz");
  assert.equal(players[1].label, "Filmoon");
});

test("parseWiflixPlayback ranks Uqload then Filmoon then VOE", () => {
  const playback = parseWiflixPlayback(SERIES_DETAILS_HTML, {
    title: "Reacher - Saison 1 · 1",
    url: "https://www.wiflix.tv/watch/reacher-saison-1?language=VF&episode=1",
  });
  assert.equal(playback.kind, "video");
  assert.equal(playback.embedUrl, "https://uqload.net/embed-lbs35sh8mjf6.html");
  assert.deepEqual(playback.sources.map((entry) => entry.label), ["Uqload", "Filmoon", "VOE"]);
});

test("relatedWiflixSearchQuery strips season suffixes", () => {
  assert.equal(relatedWiflixSearchQuery("Reacher - Saison 1"), "Reacher");
  assert.equal(relatedWiflixSearchQuery("Women In Blue - Saison 2"), "Women In Blue");
});

test("pickRelatedWiflixItems keeps other seasons", () => {
  const related = pickRelatedWiflixItems(parseWiflixCatalog(`
    ${SERIES_CARD}
    <div class="mov clearfix">
      <a class="mov-t nowrap" href="/watch/women-in-blue-saison-1">Women In Blue - Saison 1</a>
      <div class="nbloc1-2"><span class="block-sai">Saison 1</span></div>
      <div class="block-ep">Episode 10</div>
      <img src="/poster/women-in-blue-saison-1.jpg" alt="Women In Blue - Saison 1">
    </div>
  `), {
    currentId: "women-in-blue-saison-2",
    currentTitle: "Women In Blue - Saison 2",
    query: "Women In Blue",
    mediaType: "series",
  });
  assert.equal(related.length, 1);
  assert.equal(related[0].id, "women-in-blue-saison-1");
});

test("wiflixSearchVariants turns You saison 5 into a slug the site understands", () => {
  assert.ok(wiflixSearchVariants("you saison 5").includes("you-saison-5"));
  assert.ok(wiflixSearchVariants("You S5").some((entry) => /saison-5/i.test(entry)));
  assert.ok(wiflixSearchVariants("you").includes("you-saison"));
});

test("rankWiflixSearch puts You - Saison 5 before Youngblood", () => {
  assert.equal(wiflixSearchScore("You - Saison 5", "you"), 1);
  assert.ok(wiflixSearchScore("Youngblood", "you") > wiflixSearchScore("You - Saison 5", "you"));
  const ranked = rankWiflixSearch([
    { title: "Youngblood" },
    { title: "You - Saison 5" },
    { title: "Then You Run - Saison 1" },
  ], "you");
  assert.equal(ranked[0].title, "You - Saison 5");
});
