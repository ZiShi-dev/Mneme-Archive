import test from "node:test";
import assert from "node:assert/strict";
import {
  handleNovelsParadiseRequest,
  normalizeChapterUrl,
  normalizeSeriesUrl,
  parseParadiseCatalog,
  parseParadiseChapter,
  parseParadiseChapters,
  parseParadiseFilterCheckboxes,
  parseParadiseFilters,
  resolveParadiseTitles,
  seriesSlugFromSlug,
} from "../sources/novelsparadise.js";

test("novelsparadise search URL encodes spaces without double-encoding plus signs", () => {
  const query = "أنا الشرير المقدر";
  const target = new URL("https://novelsparadise.site/series/");
  target.searchParams.set("page", "1");
  target.searchParams.set("s", query);
  assert.match(target.toString(), /s=%D8%A3%D9%86%D8%A7\+/);
  assert.doesNotMatch(target.toString(), /%2B/);
});

test("novelsparadise search finds Arabic title on live site", { skip: !process.env.RUN_LIVE_SOURCE_TESTS }, async () => {
  const url = new URL("http://localhost/api/sources/novelsparadise/search");
  url.searchParams.set("q", "أنا الشرير المقدر");
  const result = await handleNovelsParadiseRequest(url);
  assert.equal(result.status, 200);
  const match = result.body.items.find((item) => item.id === "i-am-the-fated-villain");
  assert.ok(match, "expected i-am-the-fated-villain in search results");
  assert.equal(match.title, "أنا الشرير المقدر");
});

test("seriesSlugFromSlug strips trailing chapter number", () => {
  assert.equal(seriesSlugFromSlug("pharaoh-means-im-just-a-big-luo-jinxian-king-1"), "pharaoh-means-im-just-a-big-luo-jinxian-king");
});

test("normalizeSeriesUrl converts chapter url to series url", () => {
  assert.equal(
    normalizeSeriesUrl("https://novelsparadise.site/pharaoh-means-im-just-a-big-luo-jinxian-king-1/"),
    "https://novelsparadise.site/series/pharaoh-means-im-just-a-big-luo-jinxian-king/",
  );
  assert.equal(
    normalizeSeriesUrl("https://novelsparadise.site/series/pharaoh-means-im-just-a-big-luo-jinxian-king/"),
    "https://novelsparadise.site/series/pharaoh-means-im-just-a-big-luo-jinxian-king/",
  );
});

test("normalizeChapterUrl keeps chapter slug", () => {
  assert.equal(
    normalizeChapterUrl("https://novelsparadise.site/pharaoh-means-im-just-a-big-luo-jinxian-king-1/"),
    "https://novelsparadise.site/pharaoh-means-im-just-a-big-luo-jinxian-king-1/",
  );
});

test("parseParadiseCatalog reads series cards with latest chapter", () => {
  const html = `
    <article class="maindet">
      <h2 itemprop="headline"><a href="https://novelsparadise.site/series/novel-a/" title="Novel A">Novel A</a></h2>
      <div class="contexcerpt"><p>رواية أ مترجمة Novel A translated</p></div>
      <img class="ts-post-image" src="https://novelsparadise.site/cover.jpg" />
      <div class="mdinfodet">
        <span class="nchapter"><a href="https://novelsparadise.site/novel-a-12/"><i></i> الفصل. 12</a></span>
      </div>
    </article>
  `;
  const items = parseParadiseCatalog(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "أ");
  assert.equal(items[0].altTitle, "Novel A");
  assert.equal(items[0].latestChapter, "12");
});

test("resolveParadiseTitles prefers Arabic over English", () => {
  const resolved = resolveParadiseTitles("Affinity: Chaos", "رواية تقارب الفوضى");
  assert.equal(resolved.title, "تقارب الفوضى");
  assert.equal(resolved.altTitle, "Affinity: Chaos");
});

test("parseParadiseChapters merges all eplister volume blocks", () => {
  const html = `
    <div class="eplister">
      <ul>
        <li><a href="/novel-a-2/"><div class="epl-num">2</div><div class="epl-title">الثاني</div></a></li>
      </ul>
    </div>
    <span class="ts-chl-collapsible">الكتاب الثاني</span>
    <div class="ts-chl-collapsible-content">
      <div class="eplister">
        <ul>
          <li><a href="/novel-a-1/"><div class="epl-num">1</div><div class="epl-title">الأول</div></a></li>
        </ul>
      </div>
    </div>
  `;
  const chapters = parseParadiseChapters(html, "https://novelsparadise.site/series/novel-a/");
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "1");
  assert.equal(chapters[1].number, "2");
});

test("parseParadiseChapters reads eplister list", () => {
  const html = `
    <div class="eplister eplisterfull">
      <ul>
        <li><a href="/novel-a-2/"><div class="epl-num">2</div><div class="epl-title">الثاني</div><div class="epl-date">Jan 1, 2025</div></a></li>
        <li><a href="/novel-a-1/"><div class="epl-num">1</div><div class="epl-title">الأول</div></a></li>
      </ul>
    </div>
  `;
  const chapters = parseParadiseChapters(html, "https://novelsparadise.site/series/novel-a/");
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "1");
  assert.equal(chapters[1].number, "2");
});

test("parseParadiseChapters keeps alternate slug prefixes from the same series page", () => {
  const html = `
    <div class="eplister eplisterfull">
      <ul>
        <li><a href="/pharaoh-means-i-am-the-fated-villain-king-1441/"><div class="epl-num">1441</div><div class="epl-title">فصل 1441</div></a></li>
        <li><a href="/i-am-the-fated-villain-1-2/"><div class="epl-num">1</div><div class="epl-title">الأول</div></a></li>
      </ul>
    </div>
  `;
  const chapters = parseParadiseChapters(html, "https://novelsparadise.site/series/i-am-the-fated-villain/");
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].url, "https://novelsparadise.site/i-am-the-fated-villain-1-2/");
  assert.equal(chapters[1].url, "https://novelsparadise.site/pharaoh-means-i-am-the-fated-villain-king-1441/");
});

test("parseParadiseFilters reads genre and type checkboxes", () => {
  const html = `
    <form class="filters" action="/series/">
      <div class="filter dropdown">
        <ul class="dropdown-menu">
          <li><input type="checkbox" id="genre-action" name="genre[]" value="action"> <label for="genre-action">Action</label></li>
          <li><input type="checkbox" id="genre-%d8%a7%d9%83%d8%b4%d9%86" name="genre[]" value="%d8%a7%d9%83%d8%b4%d9%86"> <label for="genre-%d8%a7%d9%83%d8%b4%d9%86">اكشن</label></li>
        </ul>
      </div>
      <div class="filter dropdown">
        <ul class="dropdown-menu">
          <li><input type="checkbox" id="type-cn" name="type[]" value="%d8%b1%d9%88%d8%a7%d9%8a%d8%a7%d8%aa-%d8%b5%d9%8a%d9%86%d9%8a%d9%87"> <label for="type-cn">روايات صينيه</label></li>
        </ul>
      </div>
    </form>
  `;
  const filters = parseParadiseFilters(html);
  assert.equal(filters.categories.length, 2);
  assert.equal(filters.categories.find((entry) => entry.slug === "اكشن")?.name, "اكشن");
  assert.equal(filters.tags.length, 1);
  assert.equal(filters.tags[0].slug, "روايات-صينيه");
  assert.equal(filters.tags[0].name, "روايات صينيه");
  assert.deepEqual(parseParadiseFilterCheckboxes(html, "genre").map((entry) => entry.slug).sort(), ["action", "اكشن"].sort());
});

test("parseParadiseChapter extracts paragraphs", () => {
  const html = `
    <h1 class="entry-title">فصل 1</h1>
    <div class="epcontent entry-content"><p>فقرة أولى</p><p>فقرة ثانية</p></div>
  `;
  const chapter = parseParadiseChapter(html, "https://novelsparadise.site/novel-a-1/");
  assert.equal(chapter.kind, "novel");
  assert.equal(chapter.paragraphs.length, 2);
  assert.match(chapter.paragraphs[0], /فقرة أولى/);
});
