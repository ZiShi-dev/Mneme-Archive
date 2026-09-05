import test from "node:test";
import assert from "node:assert/strict";
import {
  ANIME4UP_CATALOG_PAGE_SIZE,
  enrichAnime4upEpisodePlayback,
  extractLatestEpisodesHtml,
  extractVnxStreamUrl,
  extractVnxSubtitleTracks,
  fetchAnime4upCatalogPage,
  fetchAnime4upEpisodes,
  isAnime4upCatalogScopedSearchPath,
  normalizeAnime4upUrl,
  parseAnime4upCatalog,
  parseAnime4upCover,
  parseAnime4upDetails,
  parseAnime4upEpisode,
  parseAnime4upEpisodes,
  pickAnime4upEmbedUrl,
} from "../sources/anime4up.js";
import { createHostContext } from "../lib/sourceBaseUrl.js";

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

test("ANIME4UP_CATALOG_PAGE_SIZE matches AnimeDar density", () => {
  assert.equal(ANIME4UP_CATALOG_PAGE_SIZE, 20);
});

test("fetchAnime4upCatalogPage enriches anime list cards with latest episodes", async () => {
  const catalogHtml = ANIME_CARD;
  const animeHtml = `
    <div class="ep_num"><a href="https://4h.b9p2m6c.shop/episode/black-torch-ep-3/">الحلقة 3</a></div>
    <div class="ep_num"><a href="https://4h.b9p2m6c.shop/episode/black-torch-ep-2/">الحلقة 2</a></div>
  `;
  const fetchHtml = async (url) => {
    if (url.includes("/anime/black-torch")) return animeHtml;
    return catalogHtml;
  };
  const ctx = { baseUrl: "https://4h.b9p2m6c.shop" };
  const payload = await fetchAnime4upCatalogPage(ctx, fetchHtml, {
    page: 1,
    filterPath: "/anime-type/tv2/",
  });
  const item = payload.items.find((entry) => entry.id === "black-torch");
  assert.ok(item, "black-torch should be present");
  assert.equal(item.latestChapter, "3");
  assert.match(item.recentChapters[0]?.url, /black-torch-ep-3/);
  assert.equal(item.audioLabel, "مترجم");
});

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

test("enrichAnime4upEpisodePlayback keeps external mirrors in sources when HLS is available", async () => {
  const html = `
    <h1>الحلقة 9</h1>
    <ul id="episode-servers">
      <li data-watch="https://4l.w2m6p5q.shop/Anime4up-S1/mal/1/9/sub/"><a>anime4up1</a></li>
      <li data-watch="https://voe.sx/e/test123"><a>voe</a></li>
      <li data-watch="https://uqload.vc/e/demo"><a>uqload</a></li>
    </ul>
  `;
  const fetchHtml = async (url) => {
    if (/Anime4up-S1/i.test(url)) {
      return 'let streamUrl = "https://cdn1.k1c6x8p.shop/?token=demo";';
    }
    throw new Error(`unexpected ${url}`);
  };
  const episode = await enrichAnime4upEpisodePlayback(
    html,
    "https://4l.w2m6p5q.shop/episode/test/",
    fetchHtml,
  );
  assert.equal(episode.playbackMode, "hls");
  assert.equal(episode.sources.length, 3);
  assert.ok(episode.sources.some((entry) => /voe\.sx/i.test(entry.url)));
  assert.ok(episode.sources.some((entry) => /uqload/i.test(entry.url)));
});

test("isAnime4upCatalogScopedSearchPath accepts genre and kind paths", () => {
  assert.equal(isAnime4upCatalogScopedSearchPath(""), false);
  assert.equal(isAnime4upCatalogScopedSearchPath("/all/"), true);
  assert.equal(isAnime4upCatalogScopedSearchPath("/anime-type/tv2/"), true);
  assert.equal(isAnime4upCatalogScopedSearchPath("/anime-type/movie/"), true);
  assert.equal(isAnime4upCatalogScopedSearchPath("/anime-genre/action/"), true);
});

const ANIME4UP_CTX = createHostContext("https://4h.b9p2m6c.shop");

test("fetchAnime4upCatalogPage skips extra fetches for movie cards", async () => {
  const movieCard = `
<div class="anime-card-themex">
  <div class="anime-card-container">
    <div class="anime-card-poster">
      <img data-image="https://4h.b9p2m6c.shop/wp-content/uploads/poster.jpg" alt="Movie Torch" />
      <a href="https://4h.b9p2m6c.shop/anime/movie-torch/" class="overlay"></a>
    </div>
    <div class="anime-card-details">
      <div class="anime-card-type">فيلم</div>
      <div class="anime-card-title">
        <h3><a href="https://4h.b9p2m6c.shop/anime/movie-torch/">Movie Torch</a></h3>
      </div>
    </div>
  </div>
</div>
`;
  const urls = [];
  const fetchHtml = async (url) => {
    urls.push(url);
    return movieCard;
  };
  const payload = await fetchAnime4upCatalogPage(ANIME4UP_CTX, fetchHtml, {
    page: 1,
    filterPath: "/anime-type/movie/",
  });
  const item = payload.items.find((entry) => entry.id === "movie-torch");
  assert.ok(item, "movie-torch should be present");
  assert.equal(item.mediaType, "movie");
  assert.equal(urls.some((url) => /\/anime\/movie-torch/i.test(url)), false);
});

test("fetchAnime4upEpisodes loads extra episode pages in parallel", async () => {
  const started = [];
  const page1 = `
    <h1 class="anime-details-title">Long Show</h1>
    <div data-max-pages="3"></div>
    <div class="ep_num"><a href="https://4h.b9p2m6c.shop/episode/long-show-ep-30/">الحلقة 30</a></div>
  `;
  const fetchHtml = (url) => {
    started.push(url);
    return new Promise((resolve) => {
      setTimeout(() => {
        const page = url.match(/\/page\/(\d+)\//)?.[1] || "1";
        resolve(`<div class="ep_num"><a href="https://4h.b9p2m6c.shop/episode/long-show-p${page}/">الحلقة ${page}</a></div>`);
      }, 40);
    });
  };
  const pending = fetchAnime4upEpisodes(
    "https://4h.b9p2m6c.shop/anime/long-show-parallel/",
    page1,
    fetchHtml,
    ANIME4UP_CTX,
  );
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.ok(started.some((url) => url.includes("/page/2/")));
  assert.ok(started.some((url) => url.includes("/page/3/")));
  const chapters = await pending;
  assert.ok(chapters.length >= 3);
});
