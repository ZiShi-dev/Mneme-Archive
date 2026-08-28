import test from "node:test";
import assert from "node:assert/strict";
import {
  extractLatestEpisodesHtml,
  extractVnxStreamUrl,
  extractVnxSubtitleTracks,
  isAnime4upCatalogScopedSearchPath,
  normalizeAnime4upUrl,
  parseAnime4upCatalog,
  parseAnime4upCover,
  parseAnime4upDetails,
  parseAnime4upEpisode,
  parseAnime4upEpisodes,
  pickAnime4upEmbedUrl,
} from "../sources/anime4up.js";

const EPISODE_CARD = `
<div class="anime-card-themex">
  <div class="anime-card-container">
    <div class="anime-card-poster">
      <div class="ep_num">
        <a href="https://4h.b9p2m6c.shop/episode/ep-8/">الحلقة 8</a>
      </div>
      <div class="hover ehover6">
        <img data-image="https://4h.b9p2m6c.shop/wp-content/uploads/cover.jpg" alt="Anime A" />
        <a href="https://4h.b9p2m6c.shop/episode/ep-8/" class="overlay"></a>
      </div>
    </div>
    <div class="anime-card-details">
      <div class="anime-card-type"><a href="https://4h.b9p2m6c.shop/anime-type/tv2/">TV</a></div>
      <div class="anime-card-title" data-content="ملخص قصير">
        <h3><a href="https://4h.b9p2m6c.shop/anime/anime-a/">Anime A</a></h3>
      </div>
    </div>
  </div>
</div>
`;

const ANIME_CARD = `
<div class="anime-card-themex">
  <div class="anime-card-container">
    <div class="anime-card-poster">
      <img data-image="https://4h.b9p2m6c.shop/wp-content/uploads/poster.jpg" alt="Black Torch" />
      <a href="https://4h.b9p2m6c.shop/anime/black-torch/" class="overlay"></a>
    </div>
    <div class="anime-card-details">
      <div class="anime-card-type">TV</div>
      <div class="anime-card-title">
        <h3><a href="https://4h.b9p2m6c.shop/anime/black-torch/">Black Torch</a></h3>
      </div>
    </div>
  </div>
</div>
`;

test("parseAnime4upCatalog reads anime list cards", () => {
  const items = parseAnime4upCatalog(ANIME_CARD);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Black Torch");
  assert.equal(items[0].id, "black-torch");
  assert.equal(items[0].mediaType, "anime");
  assert.equal(items[0].latestChapter, "—");
});

test("extractLatestEpisodesHtml keeps only latest grid cards", () => {
  const html = `
    <div class="anime-card-themex"><a href="https://4h.b9p2m6c.shop/anime/old/">Old</a></div>
    <div class="anime-grid" id="wa-latest-episodes-grid">
      ${EPISODE_CARD}
    </div>
    <div class="anime-card-themex"><a href="https://4h.b9p2m6c.shop/anime/other/">Other</a></div>
  `;
  const grid = extractLatestEpisodesHtml(html);
  const items = parseAnime4upCatalog(grid);
  assert.equal(items.length, 1);
  assert.equal(items[0].latestChapter, "8");
});

test("normalizeAnime4upUrl canonicalizes mirror host", () => {
  assert.equal(
    normalizeAnime4upUrl("https://w1.anime4up.rest/anime/test-anime/"),
    "https://4h.b9p2m6c.shop/anime/test-anime/",
  );
  assert.equal(
    normalizeAnime4upUrl("https://4j.j4n8v1x.shop/anime/test-anime/"),
    "https://4h.b9p2m6c.shop/anime/test-anime/",
  );
});

test("parseAnime4upCatalog reads cards from rotating shop mirror", () => {
  const html = EPISODE_CARD
    .replaceAll("https://4h.b9p2m6c.shop", "https://4j.j4n8v1x.shop");
  const items = parseAnime4upCatalog(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://4h.b9p2m6c.shop/anime/anime-a/");
  assert.equal(items[0].cover, "https://4j.j4n8v1x.shop/wp-content/uploads/cover.jpg");
});

test("parseAnime4upCatalog reads latest episode cards", () => {
  const items = parseAnime4upCatalog(EPISODE_CARD);
  assert.equal(items.length, 1);
  assert.equal(items[0].latestChapter, "8");
  assert.equal(items[0].latestChapterUrl, "https://4h.b9p2m6c.shop/episode/ep-8/");
});

test("parseAnime4upEpisodes collects episode links", () => {
  const chapters = parseAnime4upEpisodes(EPISODE_CARD);
  assert.equal(chapters.length, 1);
  assert.equal(chapters[0].number, "8");
});

test("parseAnime4upDetails merges metadata and chapters", () => {
  const html = `
    <h1 class="anime-details-title">Anime A</h1>
    <ul class="anime-genres"><li><a href="#">أكشن</a></li></ul>
    <p class="anime-story">قصة الأنمي</p>
    <div class="anime-info"><span>نوع الأنمي:</span> <a href="https://4h.b9p2m6c.shop/anime-type/tv2/">TV</a></div>
    <img class="thumbnail img-responsive" src="https://4h.b9p2m6c.shop/wp-content/uploads/cover.jpg" />
  `;
  const chapters = [
    { url: "https://4h.b9p2m6c.shop/episode/ep-2/", name: "2", number: "2", date: "", locked: false },
    { url: "https://4h.b9p2m6c.shop/episode/ep-1/", name: "1", number: "1", date: "", locked: false },
  ];
  const details = parseAnime4upDetails(html, "https://4h.b9p2m6c.shop/anime/anime-a/", chapters);
  assert.equal(details.title, "Anime A");
  assert.equal(details.latestChapter, "2");
  assert.equal(details.totalEpisodes, 2);
  assert.equal(details.categories[0], "أكشن");
});

test("parseAnime4upEpisodes reads special episode labels", () => {
  const html = `
    <div class="ep_num"><a href="https://4h.b9p2m6c.shop/episode/sp-2/">الحلقة الخاصة 2</a></div>
    <div class="ep_num"><a href="https://4h.b9p2m6c.shop/episode/sp-1/">الحلقة الخاصة 1</a></div>
  `;
  const chapters = parseAnime4upEpisodes(html);
  assert.equal(chapters[0].number, "الخاصة 2");
  assert.equal(chapters[1].number, "الخاصة 1");
});

test("parseAnime4upCover ignores site placeholder og:image", () => {
  const html = `
    <meta property="og:image" content="https://4h.b9p2m6c.shop/wp-content/uploads/2025/02/images.png" />
    <div class="anime-thumbnail">
      <img src="https://4h.b9p2m6c.shop/wp-content/uploads/2026/08/poster.png" class="thumbnail img-responsive" />
    </div>
  `;
  assert.equal(parseAnime4upCover(html), "https://4h.b9p2m6c.shop/wp-content/uploads/2026/08/poster.png");
});

test("pickAnime4upEmbedUrl prefers external mirrors over native player pages", () => {
  const sources = [
    { label: "mp4", url: "https://mp4upload.com/embed-abc.html" },
    { label: "voe", url: "https://voe.sx/e/test" },
    { label: "anime4up1", url: "https://4h.b9p2m6c.shop/Anime4up-S1/mal/1/1/sub/" },
  ];
  assert.match(
    pickAnime4upEmbedUrl(sources, "https://4h.b9p2m6c.shop/episode/test/"),
    /voe\.sx/,
  );
});

test("pickAnime4upEmbedUrl prefers voe over mp4upload when native player is missing", () => {
  const sources = [
    { label: "mp4", url: "https://mp4upload.com/embed-abc.html" },
    { label: "voe", url: "https://voe.sx/e/test" },
  ];
  assert.match(
    pickAnime4upEmbedUrl(sources, "https://4h.b9p2m6c.shop/episode/test/"),
    /voe\.sx/,
  );
});

test("pickAnime4upEmbedUrl prefers external mirrors over mp4upload", () => {
  const sources = [
    { label: "ext", url: "https://share4max.com/iframe/test" },
    { label: "mp4", url: "https://mp4upload.com/embed-abc.html" },
  ];
  assert.match(
    pickAnime4upEmbedUrl(sources, "https://4h.b9p2m6c.shop/episode/test/"),
    /share4max\.org/,
  );
});

test("extractVnxStreamUrl reads direct HLS url from Vnx player", () => {
  const html = `let streamUrl = "https://cdn1.example.shop/?token=abc123";`;
  assert.match(extractVnxStreamUrl(html), /cdn1\.example\.shop/);
});

test("extractVnxSubtitleTracks reads Arabic captions from Vnx player", () => {
  const html = `
    tracks = [{"file":"https://4j.j4n8v1x.shop/vnx-subtitle/test.vtt","fallbacks":["https://4j.j4n8v1x.shop/wp-content/uploads/2026/08/sub.vtt"],"label":"العربية","srclang":"ar","kind":"captions","default":true}];
  `;
  const tracks = extractVnxSubtitleTracks(html);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].label, "العربية");
  assert.equal(tracks[0].lang, "ar");
  assert.equal(tracks[0].default, true);
  assert.match(tracks[0].url, /vnx-subtitle\/test\.vtt/);
});

test("parseAnime4upEpisode keeps native player in sources but embeds external host", () => {
  const html = `
    <h1>الحلقة الخاصة 1</h1>
    <ul id="episode-servers">
      <li data-watch="https://share4max.com/iframe/test"><a>ext</a></li>
      <li data-watch="https://4h.b9p2m6c.shop/Anime4up-S1/mal/8408/1/sub/"><a>anime4up1</a></li>
      <li data-watch="https://voe.sx/e/test123"><a>voe</a></li>
      <li data-watch="https://mp4upload.com/embed-abc.html"><a>mp4</a></li>
    </ul>
  `;
  const episode = parseAnime4upEpisode(html, "https://4h.b9p2m6c.shop/episode/test/");
  assert.match(episode.embedUrl, /voe\.sx/);
  assert.ok(episode.sources.some((entry) => /Anime4up-S1/i.test(entry.url)));
});

test("isAnime4upCatalogScopedSearchPath ignores kind paths but keeps genres", () => {
  assert.equal(isAnime4upCatalogScopedSearchPath(""), false);
  assert.equal(isAnime4upCatalogScopedSearchPath("/all/"), false);
  assert.equal(isAnime4upCatalogScopedSearchPath("/anime-type/tv2/"), false);
  assert.equal(isAnime4upCatalogScopedSearchPath("/anime-type/movie/"), false);
  assert.equal(isAnime4upCatalogScopedSearchPath("/anime-genre/action/"), true);
});
