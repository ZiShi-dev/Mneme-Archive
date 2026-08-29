import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEpisodeUrl,
  buildServerEmbedUrl,
  parseAnimedarCatalog,
  parseAnimedarDetails,
  parseAnimedarEpisodes,
  parseAnimedarServerBlocks,
  parseEpisodeTarget,
  slugFromAnimeUrl,
} from "../sources/animedar.js";

const ANIME_URL = "https://animedar.net/anime-p/demo-anime/";
const CARD_HTML = `
<article class="bs ss1" itemscope="itemscope" itemtype="http://schema.org/CreativeWork">
  <div class="bsx">
    <a href="https://animedar.net/anime-p/demo-anime/" itemprop="url" title="Demo Anime" class="tip" rel="100">
      <div class="limit">
        <div class="typez TV">مسلسل</div>
        <div class="ep-number"><span>الحلقة 9</span></div>
        <img src="https://animedar.net/wp-content/uploads/2026/01/cover.jpg" class="ts-post-image wp-post-image" alt="Demo Anime" />
      </div>
      <div class="tt">
        Demo Anime
        <h2 itemprop="headline">Demo Anime</h2>
      </div>
    </a>
  </div>
</article>
`;

const DETAILS_HTML = `
<h1 class="entry-title">Demo Anime</h1>
<span class="alter">Alt Demo</span>
<div class="thumb"><img src="https://animedar.net/wp-content/uploads/2026/01/cover.jpg" /></div>
<div class="mindesc">ملخص الأنمي</div>
<div class="spe">
  <span><b>الحالة:</b> يعرض الأن</span>
  <span><b>الحلقات:</b> 3</span>
  <span><b>النوع:</b> مسلسل</span>
  <span><b>تم الإصدار:</b> 2026</span>
</div>
<div class="genxed"><a href="https://animedar.net/genres/action/">Action</a></div>
<div id="EpList1">
  <div class='CSB' id='IDSB1'>الحلقة 1</div>
  <div class='CSB' id='IDSB2'>الحلقة 2</div>
  <div class='CSB' id='IDSB3'>الحلقة 3</div>
</div>
<div class="divv11"><div class="serversss"><ul><li source="ani" quality-data="FHD" data="abc123" class="asnwish" type="asnwish">ASNWISH</li></ul></div></div>
<div class="divv11"><div class="serversss"><ul><li source="ani" quality-data="HD" data="vid001" class="videa" type="videa">VIDEA</li></ul></div></div>
<div class="divv11"><div class="serversss"><ul><li source="ani" quality-data="FHD" data="dm001" class="dailymotion" type="dailymotion">DM</li></ul></div></div>
`;

test("parseAnimedarCatalog extracts anime cards", () => {
  const items = parseAnimedarCatalog(CARD_HTML);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Demo Anime");
  assert.equal(items[0].sourceId, "animedar");
  assert.equal(items[0].latestChapter, "9");
  assert.equal(items[0].mediaType, "anime");
});

test("slugFromAnimeUrl and buildEpisodeUrl work with ep query", () => {
  assert.equal(slugFromAnimeUrl(ANIME_URL), "demo-anime");
  assert.equal(
    buildEpisodeUrl(ANIME_URL, 2),
    "https://animedar.net/anime-p/demo-anime/?ep=2",
  );
  assert.deepEqual(parseEpisodeTarget("https://animedar.net/anime-p/demo-anime/?ep=2"), {
    animeUrl: ANIME_URL,
    episode: 2,
    slug: "demo-anime",
  });
});

test("parseAnimedarEpisodes maps CSB buttons and server blocks", () => {
  const chapters = parseAnimedarEpisodes(DETAILS_HTML, ANIME_URL);
  assert.equal(chapters.length, 3);
  assert.equal(chapters[0].number, "3");
  assert.match(chapters[0].url, /ep=3/);
});

test("parseAnimedarServerBlocks and buildServerEmbedUrl resolve hosts", () => {
  const blocks = parseAnimedarServerBlocks(DETAILS_HTML);
  assert.equal(blocks.length, 3);
  assert.equal(buildServerEmbedUrl({ type: "asnwish", data: "abc123" }), "https://asnwish.com/e/abc123");
  assert.equal(buildServerEmbedUrl({ type: "videa", data: "vid001" }), "https://videa.hu/player?v=vid001");
  assert.equal(blocks[0][0].url, "https://asnwish.com/e/abc123");
});

test("parseAnimedarDetails merges metadata and chapters", () => {
  const chapters = parseAnimedarEpisodes(DETAILS_HTML, ANIME_URL);
  const details = parseAnimedarDetails(DETAILS_HTML, ANIME_URL, chapters);
  assert.equal(details.title, "Demo Anime");
  assert.equal(details.altTitle, "Alt Demo");
  assert.equal(details.totalEpisodes, 3);
  assert.deepEqual(details.categories, ["Action"]);
  assert.equal(details.chapters.length, 3);
});
