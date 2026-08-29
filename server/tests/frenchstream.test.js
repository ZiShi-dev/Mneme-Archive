import test from "node:test";
import assert from "node:assert/strict";
import {
  assertChapterUrl,
  assertMovieUrl,
  decodePackedPlayerSource,
  episodeNumberFromUrl,
  episodeToPlayers,
  extractPackedPlayerStreamUrl,
  flattenFrenchStreamPlayers,
  frenchStreamAudioLanguagesFromEpisodeData,
  newsIdFromUrl,
  normalizeFrenchStreamAudioLabel,
  normalizeFrenchStreamUrl,
  parseFrenchStreamCatalog,
  parseFrenchStreamDetails,
  parseFrenchStreamPlayback,
  parseFrenchStreamSearch,
  parseFrenchStreamSeriesChapters,
  parseFrenchStreamFilters,
  isRelatedFrenchStreamTitle,
  pickRelatedFrenchStreamMovies,
  pickRelatedFrenchStreamSeasons,
  relatedSearchQuery,
} from "../sources/frenchstream.js";

const FILM_CARD = `
<div class="short"><div class="short-in nl">
  <span id="desc-15125403" style="display:none;">Un homme du futur débarque dans un diner.</span>
  <span class="film-quality"><a href="/index.php?do=xfsearch&amp;xfname=qualit&amp;xf=HD">HD</a></span>
  <span class="film-version"><a href="/index.php?do=xfsearch&amp;xfname=version-film&amp;xf=VF%2BVOSTFR">VF+VOSTFR</a></span>
  <a class="short-poster img-box with-mask" href="/index.php?newsid=15125403" alt="Good Luck">
    <img src="https://image.tmdb.org/t/p/w300/poster.jpg" alt="Good Luck affiche" />
  </a>
  <div class="short-title">Good Luck, Have Fun, Don't Die</div>
</div></div>
`;

const SERIES_CARD = `
<div class="short"><div class="short-in nl">
  <span class="film-version"><a href="/index.php?do=xfsearch&amp;xfname=version-serie&amp;xf=VF">VF</a></span>
  <a class="short-poster img-box with-mask" href="/index.php?newsid=15133013" alt="The Shards">
    <img src="https://image.tmdb.org/t/p/w500/serie.jpg" alt="The Shards" />
  </a>
  <span class="mli-eps">Ep 07 sur 10</span>
  <div class="short-title">The Shards - Saison 1</div>
</div></div>
`;

const DETAILS_HTML = `
<div id="film-data"
    data-newsid="1022"
    data-title="Inception"
    data-affiche="https://image.tmdb.org/t/p/w400/cover.jpg">
</div>
<h1 id="s-title">Inception <span class="tag release_date"> - <a href="/index.php?do=xfsearch&amp;xfname=date-de-sortie&amp;xf=2010">2010</a></span></h1>
<span class="genres"><a href="/xfsearch/genre-1/Action/">Action</a>, <a href="/xfsearch/genre-1/Science-Fiction/">Science-Fiction</a></span>
<span class="runtime">- 2h28</span>
<div class="fdesc clearfix slice-this" id="s-desc">
  <p class="desc-text">Résumé</p>
  Un voleur s'infiltre dans les rêves.
</div>
<span id="film_lang"><a>VF+VOSTFR</a></span>
<span id="film_quality"><a>HD</a></span>
<img src="https://image.tmdb.org/t/p/w400/cover.jpg" class="dvd-thumbnail" alt="Inception">
`;

test("normalizeFrenchStreamUrl keeps newsid links on french-stream.one", () => {
  assert.equal(
    normalizeFrenchStreamUrl("https://www.french-stream.one/index.php?newsid=15125403"),
    "https://french-stream.one/index.php?newsid=15125403",
  );
  assert.equal(normalizeFrenchStreamUrl("https://evil.example/index.php?newsid=1"), "");
});

test("newsIdFromUrl reads query and pretty film urls", () => {
  assert.equal(newsIdFromUrl("https://french-stream.one/index.php?newsid=15125403"), "15125403");
  assert.equal(newsIdFromUrl("https://french-stream.one/1022-inception-film-streaming-complet-vf.html"), "1022");
});

test("assertMovieUrl canonicalizes pretty urls to newsid", () => {
  assert.equal(
    assertMovieUrl("https://french-stream.one/1022-inception-film-streaming-complet-vf.html"),
    "https://french-stream.one/index.php?newsid=1022",
  );
});

test("parseFrenchStreamCatalog reads films and series", () => {
  const items = parseFrenchStreamCatalog(FILM_CARD + SERIES_CARD);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Good Luck, Have Fun, Don't Die");
  assert.equal(items[0].id, "15125403");
  assert.equal(items[0].mediaType, "movie");
  assert.equal(items[0].audioLabel, "VF+VOSTFR");
  assert.equal(items[0].latestChapter, "HD");
  assert.match(items[0].url, /newsid=15125403/);
  assert.equal(items[1].title, "The Shards - Saison 1");
  assert.equal(items[1].mediaType, "series");
  assert.equal(items[1].audioLabel, "VF");
  assert.equal(items[1].latestChapter, "7");
  assert.match(items[1].latestChapterUrl, /ep=7/);
});

test("parseFrenchStreamFilters can expose series genres separately from film genres", () => {
  const html = `
    <a href="/films/action/">Action films</a>
    <a href="/action-serie-/">Action series</a>
    <a href="/xfsearch/date-de-sortie/2024/">2024</a>
  `;
  const films = parseFrenchStreamFilters(html);
  const series = parseFrenchStreamFilters(html, { includeSeriesGenres: true });
  assert.equal(films.categories.length, 1);
  assert.equal(films.categories[0].mediaKind, "movies");
  assert.equal(series.categories.length, 1);
  assert.equal(series.categories[0].mediaKind, "series");
  assert.equal(series.categories[0].filterPath, "/action-serie-/");
});

test("parseFrenchStreamSearch reads ajax search items", () => {
  const html = `<div class='search-item' onclick="location.href='/1022-inception-film-streaming-complet-vf.html'"><div class='search-poster'><img src='https://image.tmdb.org/t/p/w400/aej.jpg' alt='Inception'></div><div class='search-info'><div class='search-title'>Inception (2010)</div></div></div>`;
  const items = parseFrenchStreamSearch(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Inception");
  assert.equal(items[0].id, "1022");
  assert.equal(items[0].altTitle, "2010");
  assert.equal(items[0].audioLabel, "VF");
});

test("parseFrenchStreamDetails reads poster, year and genres", () => {
  const details = parseFrenchStreamDetails(DETAILS_HTML, "https://french-stream.one/index.php?newsid=1022");
  assert.equal(details.title, "Inception");
  assert.equal(details.cover, "https://image.tmdb.org/t/p/w400/cover.jpg");
  assert.equal(details.year, "2010");
  assert.deepEqual(details.categories, ["Action", "Science-Fiction"]);
  assert.equal(details.chapters.length, 1);
  assert.equal(details.mediaType, "movie");
  assert.equal(details.audioLabel, "VF+VOSTFR");
  assert.deepEqual(details.relatedItems, []);
});

test("normalizeFrenchStreamAudioLabel reads VF and VOSTFR", () => {
  assert.equal(normalizeFrenchStreamAudioLabel("VF"), "VF");
  assert.equal(normalizeFrenchStreamAudioLabel("VOSTFR"), "VOSTFR");
  assert.equal(normalizeFrenchStreamAudioLabel("VF+VOSTFR"), "VF+VOSTFR");
  assert.equal(normalizeFrenchStreamAudioLabel("VFQ"), "VF");
  assert.equal(normalizeFrenchStreamAudioLabel("French"), "VF");
  assert.equal(normalizeFrenchStreamAudioLabel("TrueFrench"), "VF");
  assert.equal(normalizeFrenchStreamAudioLabel(""), "");
});

test("relatedSearchQuery strips sequel numbers, subtitles and season suffixes", () => {
  assert.equal(relatedSearchQuery("John Wick 4"), "John Wick");
  assert.equal(relatedSearchQuery("John Wick : Parabellum"), "John Wick");
  assert.equal(relatedSearchQuery("John Wick Chapitre 4"), "John Wick");
  assert.equal(relatedSearchQuery("The Shards - Saison 1"), "The Shards");
  assert.equal(relatedSearchQuery("Star Trek: Strange New Worlds - Saison 4"), "Star Trek: Strange New Worlds");
});

test("pickRelatedFrenchStreamMovies keeps franchise sequels in year order", () => {
  const html = [
    `<div class='search-item' onclick="location.href='/15113796-john-wick-chapitre-4.html'"><div class='search-poster'><img src='https://image.tmdb.org/t/p/w400/v.jpg' alt='John Wick 4'></div><div class='search-info'><div class='search-title'>John Wick 4 (2023)</div></div></div>`,
    `<div class='search-item' onclick="location.href='/169601-john-wick-2-film-streaming-complet-vf.html'"><div class='search-poster'><img src='https://image.tmdb.org/t/p/w400/r.jpg' alt='John Wick 2'></div><div class='search-info'><div class='search-title'>John Wick 2 (2017)</div></div></div>`,
    `<div class='search-item' onclick="location.href='/169600-john-wick-film-streaming-complet-vf.html'"><div class='search-poster'><img src='https://image.tmdb.org/t/p/w400/u.jpg' alt='John Wick'></div><div class='search-info'><div class='search-title'>John Wick (2014)</div></div></div>`,
    `<div class='search-item' onclick="location.href='/15115054-le-continental-daprs-lunivers-de-john-wick-saison-1.html'"><div class='search-poster'><img src='https://image.tmdb.org/t/p/w400/w.jpg' alt='Saison'></div><div class='search-info'><div class='search-title'>Le Continental : d'Après l'Univers de John Wick - Saison 1</div></div></div>`,
  ].join("");
  const related = pickRelatedFrenchStreamMovies(parseFrenchStreamSearch(html), {
    currentId: "169600",
    currentTitle: "John Wick",
    query: "John Wick",
  });
  assert.deepEqual(related.map((item) => item.title), ["John Wick 2", "John Wick 4"]);
  assert.equal(related[0].year, "2017");
  assert.equal(isRelatedFrenchStreamTitle("John Wick", "John Wick 2", "John Wick"), true);
  assert.equal(isRelatedFrenchStreamTitle("John Wick", "John Wick", "John Wick"), false);
});

test("flattenFrenchStreamPlayers prefers vidzy then uqload", () => {
  const sources = flattenFrenchStreamPlayers({
    dood: { default: "https://kakaflix.lol/doood/newPlayer.php?id=1" },
    uqload: { default: "https://uqload.vc/embed-abc.html", vostfr: "https://uqload.vc/embed-vost.html" },
    vidzy: { default: "https://vidzy.cc/embed-xyz.html" },
  });
  assert.equal(sources[0].url, "https://vidzy.cc/embed-xyz.html");
  assert.equal(sources[1].label, "Uqload");
  assert.equal(sources[2].label, "Uqload VOSTFR");
});

test("parseFrenchStreamPlayback returns embed sources", () => {
  const playback = parseFrenchStreamPlayback(
    { players: { vidzy: { default: "https://vidzy.cc/embed-xyz.html" } } },
    { title: "Inception", url: "https://french-stream.one/index.php?newsid=1022" },
  );
  assert.equal(playback.kind, "video");
  assert.equal(playback.embedUrl, "https://vidzy.cc/embed-xyz.html");
});

function packPlayerSource(plain, hostname = "vidzy.cc") {
  let seed = 0;
  for (let index = 0; index < hostname.length; index += 1) {
    seed = (seed + hostname.charCodeAt(index)) & 255;
  }
  let scrambled = "";
  for (let index = 0; index < plain.length; index += 1) {
    scrambled += String.fromCharCode(plain.charCodeAt(index) ^ ((0x3d + index * 89 + seed) & 255));
  }
  return btoa(scrambled.split("").reverse().join(""));
}

test("extractPackedPlayerStreamUrl decodes the real HLS url and skips decoys", () => {
  const stream = "https://v6.vidzy.cc/hls2/01/00060/file.urlset/master.m3u8?t=abc";
  const packed = packPlayerSource(stream, "vidzy.cc");
  assert.equal(decodePackedPlayerSource(packed, "vidzy.cc"), stream);
  const html = `jwplayer("vplayer").setup({ sources: [{src: (function(s){return "https://s1.fsvid.lol/troll/master.m3u8"})("${packed}")}]});`;
  assert.equal(extractPackedPlayerStreamUrl(html, "vidzy.cc"), stream);
  assert.equal(
    extractPackedPlayerStreamUrl('file: "https://s1.fsvid.lol/troll/master.m3u8"', "vidzy.cc"),
    "",
  );
});

test("extractPackedPlayerStreamUrl supports vidzy.live embed host", () => {
  const stream = "https://v6.vidzy.cc/hls2/03/00060/,0b77x8wh2hrb_n,.urlset/master.m3u8?t=abc";
  const packed = packPlayerSource(stream, "vidzy.live");
  const html = `sources: [{src: (function(s){return "https://s1.fsvid.lol/troll/master.m3u8"})("${packed}")}]`;
  assert.equal(extractPackedPlayerStreamUrl(html, "vidzy.live"), stream);
});

test("flattenFrenchStreamPlayers prefers vidzy.live before uqload", () => {
  const sources = flattenFrenchStreamPlayers({
    uqload: { default: "https://uqload.vc/embed-abc.html" },
    vidzy: { default: "https://vidzy.live/embed-xyz.html" },
  });
  assert.equal(sources[0].url, "https://vidzy.live/embed-xyz.html");
});

const SERIES_DETAILS_HTML = `
<div id="serie-data"
    data-newsid="15131656"
    data-title="Star Trek: Strange New Worlds - Saison 4"
    data-affiche="https://image.tmdb.org/t/p/w500/cover.jpg">
</div>
<span class="sd-tagz"><a href="/index.php?do=xfsearch&amp;xfname=tagz&amp;xf=s-103516">s-103516</a></span>
<h1 id="s-title">Star Trek: Strange New Worlds - Saison 4</h1>
<span class="genres">Science-Fiction, Drame</span> - <span class="runtime">59 min</span>
<div class="fdesc"><p>L'équipage de l'Enterprise explore de nouveaux mondes.</p></div>
`;

const SERIES_EPISODES = {
  vf: {
    1: { vidzy: "https://vidzy.cc/embed-ep1.html", uqload: "https://uqload.vc/embed-ep1.html" },
    2: { vidzy: "https://vidzy.org/embed-ep2.html" },
  },
  vostfr: {
    1: { vidzy: "https://vidzy.cc/embed-ep1-vost.html" },
  },
  vo: {},
  info: {
    1: { title: "Valles Marineris" },
    2: { title: "Épisode 2" },
    7: { title: "Épisode 7" },
  },
};

test("parseFrenchStreamSearch includes series seasons", () => {
  const html = `<div class='search-item' onclick="location.href='/15131656-star-trek-strange-new-worlds-saison-4.html'"><div class='search-poster'><img src='https://image.tmdb.org/t/p/w400/s.jpg' alt='Star Trek'></div><div class='search-info'><div class='search-title'>Star Trek: Strange New Worlds - Saison 4</div></div></div>`;
  const items = parseFrenchStreamSearch(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].mediaType, "series");
  assert.equal(items[0].mediaTypeLabel, "مسلسل");
  assert.match(items[0].latestChapterUrl, /ep=1/);
});

test("parseFrenchStreamDetails reads series seasons", () => {
  const details = parseFrenchStreamDetails(SERIES_DETAILS_HTML, "https://french-stream.one/index.php?newsid=15131656");
  assert.equal(details.mediaType, "series");
  assert.equal(details.title, "Star Trek: Strange New Worlds - Saison 4");
  assert.equal(details.cover, "https://image.tmdb.org/t/p/w500/cover.jpg");
  assert.deepEqual(details.categories, ["Science-Fiction", "Drame"]);
  assert.equal(details.serieTag, "s-103516");
  assert.match(details.summary, /Enterprise/);
});

test("parseFrenchStreamSeriesChapters keeps playable episodes only", () => {
  const chapters = parseFrenchStreamSeriesChapters(SERIES_EPISODES, "https://french-stream.one/index.php?newsid=15131656");
  assert.deepEqual(chapters.map((chapter) => chapter.number), ["1", "2"]);
  assert.equal(chapters[0].name, "1 · Valles Marineris");
  assert.match(chapters[1].url, /ep=2/);
  assert.deepEqual(chapters[0].audioLanguages, {
    VF: "https://french-stream.one/index.php?newsid=15131656&ep=1",
    VOSTFR: "https://french-stream.one/index.php?newsid=15131656&ep=1",
  });
  assert.deepEqual(chapters[1].audioLanguages, {
    VF: "https://french-stream.one/index.php?newsid=15131656&ep=2",
  });
});

test("frenchStreamAudioLanguagesFromEpisodeData aggregates VF and VOSTFR", () => {
  assert.deepEqual(frenchStreamAudioLanguagesFromEpisodeData(SERIES_EPISODES), ["VF", "VOSTFR"]);
});

test("episodeToPlayers prefers VF and keeps VOSTFR variants", () => {
  const sources = flattenFrenchStreamPlayers(episodeToPlayers(SERIES_EPISODES, 1));
  assert.equal(sources[0].url, "https://vidzy.cc/embed-ep1.html");
  assert.equal(sources.some((source) => source.label.includes("VOSTFR")), true);
});

test("flattenFrenchStreamPlayers filters by requested language", () => {
  const players = episodeToPlayers(SERIES_EPISODES, 1);
  const vfOnly = flattenFrenchStreamPlayers(players, "VF");
  const vostOnly = flattenFrenchStreamPlayers(players, "VOSTFR");
  assert.equal(vfOnly.every((source) => !/VOSTFR/i.test(source.label)), true);
  assert.equal(vostOnly.every((source) => /VOSTFR/i.test(source.label)), true);
});

test("assertChapterUrl preserves episode numbers", () => {
  assert.equal(episodeNumberFromUrl("https://french-stream.one/index.php?newsid=15131656&ep=6"), "6");
  assert.equal(
    assertChapterUrl("https://french-stream.one/15131656-star-trek-saison-4.html?ep=6"),
    "https://french-stream.one/index.php?newsid=15131656&ep=6",
  );
  assert.equal(
    assertMovieUrl("https://french-stream.one/index.php?newsid=15131656&ep=6"),
    "https://french-stream.one/index.php?newsid=15131656",
  );
});

test("pickRelatedFrenchStreamSeasons skips the current season", () => {
  const related = pickRelatedFrenchStreamSeasons([
    { id: 15131656, title: "Saison 4", full_url: "15131656-saison-4.html", affiche: "https://image.tmdb.org/t/p/w400/4.jpg" },
    { id: 15111412, title: "Star Trek - Saison 1", full_url: "15111412-saison-1.html", affiche: "https://image.tmdb.org/t/p/w400/1.jpg" },
    { id: 15121663, title: "Star Trek - Saison 3", full_url: "15121663-saison-3.html", affiche: "https://image.tmdb.org/t/p/w400/3.jpg" },
  ], "15131656");
  assert.deepEqual(related.map((item) => item.id), ["15111412", "15121663"]);
  assert.equal(related[0].mediaType, "series");
  assert.match(related[0].url, /15111412/);
});
