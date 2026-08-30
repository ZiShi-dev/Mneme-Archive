import test from "node:test";
import assert from "node:assert/strict";
import {
  assertCoflixImageUrl,
  assertFilterPath,
  buildCatalogUrl,
  catalogHasMore,
  normalizeCoflixUrl,
  parseCoflixCatalog,
  parseCoflixDetails,
  parseCoflixFilters,
  parseCoflixPlayers,
  resolveCoflixContext,
} from "../sources/coflix.js";

const ctx = { baseUrl: "https://coflix.esq", baseHost: "coflix.esq" };

const FILM_CARD = `
<div class="md-manga-card">
  <a href="/film/jack-reacher/">
    <img data-src="https://image.tmdb.org/t/p/w500/poster.jpg" alt="Jack Reacher">
    <p class="md-manga-card-name">Jack Reacher</p>
    <span class="md-card-badge year">2012</span>
    <span class="md-card-badge quality">HD</span>
    <p class="md-card-overlay-synopsis">Un sniper armé.</p>
    <span class="md-manga-card-flag" title="VF"></span>
  </a>
</div>
`;

const FILTERS_HTML = `
<a href="/genres/?genre=action">Action</a>
<a href="/genres/?genre=comedie">Comédie</a>
<a href="https://evil.example/genres/?genre=hack">Hack</a>
`;

const DETAILS_HTML = `
<title>Jack Reacher | Coflix</title>
<h1 class="md-hero-title">Jack Reacher</h1>
<meta property="og:image" content="https://image.tmdb.org/t/p/w500/hero.jpg">
<meta property="og:description" content="Résumé du film.">
<span class="md-card-badge year">2012</span>
<iframe src="https://uqload.net/embed-abc123.html"></iframe>
<a data-url="https://vidzy.net/embed-xyz.html">Vidzy</a>
`;

test("resolveCoflixContext uses baseUrl query param", () => {
  const url = new URL("https://app.test/api/sources/coflix/catalog?baseUrl=https%3A%2F%2Fcoflix.foo");
  const resolved = resolveCoflixContext(url);
  assert.equal(resolved.baseUrl, "https://coflix.foo");
  assert.equal(resolved.baseHost, "coflix.foo");
});

test("normalizeCoflixUrl rewrites site links and assertCoflixImageUrl allows TMDB", () => {
  assert.equal(
    assertCoflixImageUrl("https://image.tmdb.org/t/p/w500/poster.jpg", ctx),
    "https://image.tmdb.org/t/p/w500/poster.jpg",
  );
  assert.equal(
    normalizeCoflixUrl("/film/test/", ctx),
    "https://coflix.esq/film/test/",
  );
});

test("parseCoflixCatalog extracts movie cards", () => {
  const items = parseCoflixCatalog(FILM_CARD, ctx, { defaultMediaType: "movie" });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Jack Reacher");
  assert.equal(items[0].sourceId, "coflix");
  assert.equal(items[0].mediaType, "movie");
  assert.equal(items[0].audioLabel, "VF");
  assert.match(items[0].url, /\/film\/jack-reacher\//);
});

test("parseCoflixFilters keeps allowed genre links", () => {
  const { categories } = parseCoflixFilters(FILTERS_HTML, ctx);
  assert.deepEqual(categories.map((entry) => entry.slug), ["action", "comedie"]);
  assert.equal(categories[0].filterPath, "/genres/?genre=action");
});

test("buildCatalogUrl and catalogHasMore handle movies pagination", () => {
  assert.equal(buildCatalogUrl(1, "/films/", ctx), "https://coflix.esq/films/");
  assert.equal(buildCatalogUrl(2, "/films/", ctx), "https://coflix.esq/films/page/2/");
  assert.equal(assertFilterPath("/films/"), "/films/");
  assert.equal(catalogHasMore('<a href="/films/page/2/">2</a>', 1, "/films/"), true);
});

test("buildCatalogUrl paginates genre filters", () => {
  const filterPath = "/genres/?genre=action";
  assert.equal(buildCatalogUrl(1, filterPath, ctx), "https://coflix.esq/genres/?genre=action");
  assert.equal(buildCatalogUrl(2, filterPath, ctx), "https://coflix.esq/genres/page/2/?genre=action");
  assert.equal(catalogHasMore('<a href="/genres/page/2/?genre=action">2</a>', 1, filterPath), true);
});

test("parseCoflixDetails and players extract playback sources", () => {
  const details = parseCoflixDetails(DETAILS_HTML, "https://coflix.esq/film/jack-reacher/", ctx);
  assert.equal(details.title, "Jack Reacher");
  assert.equal(details.mediaType, "movie");
  assert.equal(details.year, "2012");
  const players = parseCoflixPlayers(DETAILS_HTML);
  assert.ok(players.some((entry) => /uqload/i.test(entry.url)));
});
