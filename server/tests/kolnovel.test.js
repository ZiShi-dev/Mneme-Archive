import test from "node:test";
import assert from "node:assert/strict";
import {
  extractKolnovelChapterNumber,
  fetchKolnovelCatalogPage,
  KOLNOVEL_CATALOG_PAGE_SIZE,
  normalizeChapterUrl,
  normalizeSeriesUrl,
  parseKolnovelCatalog,
  parseKolnovelChapters,
  seriesSlugFromSlug,
} from "../sources/kolnovel.js";
import { parseParadiseChapter, catalogHasMorePages, extractParadiseParagraphs } from "../sources/novelsparadise.js";
import { dedupeChapters } from "../lib/chapterOrdering.js";

test("seriesSlugFromSlug strips trailing chapter number", () => {
  assert.equal(seriesSlugFromSlug("48hours-a-day-1"), "48hours-a-day");
});

test("normalizeSeriesUrl converts chapter url to series url", () => {
  assert.equal(
    normalizeSeriesUrl("https://kolnovel.com/series/48hours-a-day/"),
    "https://kolnovel.com/series/48hours-a-day/",
  );
});

test("normalizeChapterUrl keeps kolnovel chapter slug", () => {
  assert.equal(
    normalizeChapterUrl("https://kolnovel.com/shaag2448hours-a-dayz435ggye-265652/"),
    "https://kolnovel.com/shaag2448hours-a-dayz435ggye-265652/",
  );
});

test("parseKolnovelCatalog reads series cards", () => {
  const html = `
    <article class="maindet">
      <h2 itemprop="headline"><a href="https://kolnovel.com/series/novel-a/" title="Novel A">Novel A</a></h2>
      <span class="mdgenre"><a href="https://kolnovel.com/genre/action/"># أكشن</a></span>
      <div class="contexcerpt"><p>رواية أ مترجمة Novel A</p></div>
      <img class="ts-post-image" src="https://kolnovel.com/cover.jpg" />
      <div class="mdinfodet">
        <span class="nchapter"><a href="https://kolnovel.com/shaag24novel-az435ggye-12/"><i></i> الفصل. 12</a></span>
      </div>
    </article>
  `;
  const items = parseKolnovelCatalog(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "novel-a");
  assert.equal(items[0].latestChapter, "12");
  assert.equal(items[0].recentChapters.length, 1);
  assert.equal(items[0].recentChapters[0].number, "12");
  assert.equal(items[0].latestChapterUrl, "https://kolnovel.com/shaag24novel-az435ggye-12/");
  assert.deepEqual(items[0].genres, ["أكشن"]);
});

test("KOLNOVEL_CATALOG_PAGE_SIZE matches Realm Novel / Cenele density", () => {
  assert.equal(KOLNOVEL_CATALOG_PAGE_SIZE, 24);
});

test("parseKolnovelCatalog ignores kolnovel post ids in chapter urls", () => {
  const html = `
    <article class="maindet">
      <h2 itemprop="headline"><a href="https://kolnovel.com/series/novel-a/" title="Novel A">Novel A</a></h2>
      <img class="ts-post-image" src="https://kolnovel.com/cover.jpg" />
      <div class="mdinfodet">
        <span class="nchapter"><a href="https://kolnovel.com/shaag24novel-az435ggye-290554/"><i></i> الفصل 100</a></span>
      </div>
    </article>
  `;
  const items = parseKolnovelCatalog(html);
  assert.equal(items[0].latestChapter, "100");
  assert.equal(items[0].recentChapters.length, 1);
  assert.equal(items[0].recentChapters[0].number, "100");
});

test("fetchKolnovelCatalogPage keeps catalog nchapter urls without series fetch", async () => {
  const catalogHtml = `
    <article class="maindet">
      <h2 itemprop="headline"><a href="https://kolnovel.com/series/novel-a/" title="Novel A">Novel A</a></h2>
      <img class="ts-post-image" src="https://kolnovel.com/cover.jpg" />
      <div class="mdinfodet">
        <span class="nchapter"><a href="https://kolnovel.com/shaag24novel-az435ggye-12/"><i></i> الفصل. 12</a></span>
      </div>
    </article>
  `;
  const seriesHtml = `
    <div class="eplister"><ul>
      <li><a href="https://kolnovel.com/shaag24novel-az435ggye-99/"><span class="epl-num">الفصل 99</span><span class="epl-title">الأخير</span></a></li>
    </ul></div>
  `;
  let seriesFetched = false;
  const fetchHtml = async (url) => {
    if (url.includes("/series/novel-a")) {
      seriesFetched = true;
      return seriesHtml;
    }
    return catalogHtml;
  };

  const ctx = { baseUrl: "https://kolnovel.com" };
  const payload = await fetchKolnovelCatalogPage(ctx, fetchHtml, { page: 1 });
  const item = payload.items.find((entry) => entry.id === "novel-a");
  assert.ok(item, "novel-a should be present");
  assert.equal(item.latestChapter, "12");
  assert.match(item.recentChapters[0]?.url, /shaag24novel-az435ggye-12/);
  assert.equal(seriesFetched, false);
});

test("fetchKolnovelCatalogPage enriches cards without nchapter links", async () => {
  const catalogHtml = `
    <article class="maindet">
      <h2 itemprop="headline"><a href="https://kolnovel.com/series/novel-a/" title="Novel A">Novel A</a></h2>
      <img class="ts-post-image" src="https://kolnovel.com/cover.jpg" />
    </article>
  `;
  const seriesHtml = `
    <div class="eplister"><ul>
      <li><a href="https://kolnovel.com/shaag24novel-az435ggye-99/"><span class="epl-num">الفصل 99</span><span class="epl-title">الأخير</span></a></li>
      <li><a href="https://kolnovel.com/shaag24novel-az435ggye-98/"><span class="epl-num">الفصل 98</span></a></li>
    </ul></div>
  `;
  const fetchHtml = async (url) => {
    if (url.includes("/series/novel-a")) return seriesHtml;
    return catalogHtml;
  };

  const ctx = { baseUrl: "https://kolnovel.com" };
  const payload = await fetchKolnovelCatalogPage(ctx, fetchHtml, { page: 1 });
  const item = payload.items.find((entry) => entry.id === "novel-a");
  assert.ok(item, "novel-a should be present");
  assert.equal(item.latestChapter, "99");
  assert.match(item.recentChapters[0]?.url, /shaag24novel-az435ggye-99/);
});

test("dedupeChapters prefers kolnovel chapter labels over z435ggye post ids", () => {
  const [chapter] = dedupeChapters([{
    url: "https://kolnovel.com/shaag24novel-az435ggye-290554/",
    number: "100",
    name: "الفصل 100",
  }]);
  assert.equal(chapter.number, "100");
});

test("fetchKolnovelCatalogPage returns 24 catalog items like Cenele", async () => {
  const requested = [];
  const upstreamCatalogHtml = (count, page, { hasNext = true } = {}) => {
    const cards = Array.from({ length: count }, (_, index) => {
      const id = `series-${page}-${String.fromCharCode(97 + index)}`;
      return `
        <article class="maindet">
          <h2 itemprop="headline"><a href="https://kolnovel.com/series/${id}/" title="Novel ${id}">Novel ${id}</a></h2>
          <img class="ts-post-image" src="https://kolnovel.com/cover.jpg" />
          <div class="mdinfodet">
            <span class="nchapter"><a href="https://kolnovel.com/shaag24${id}-az435ggye-12/"><i></i> الفصل. 12</a></span>
          </div>
        </article>
      `;
    }).join("");
    const nextLink = hasNext
      ? `<div class="hpage"><a href="?page=${page + 1}&status=&order=latest" class="r">Next</a></div>`
      : "";
    return `${cards}${nextLink}`;
  };

  const fetchHtml = async (url) => {
    requested.push(url);
    if (url.includes("page=1")) return upstreamCatalogHtml(20, 1);
    if (url.includes("page=2")) return upstreamCatalogHtml(20, 2, { hasNext: true });
    return upstreamCatalogHtml(20, 3, { hasNext: false });
  };

  const ctx = { baseUrl: "https://kolnovel.com" };
  const payload = await fetchKolnovelCatalogPage(ctx, fetchHtml, { page: 1 });
  assert.equal(payload.items.length, KOLNOVEL_CATALOG_PAGE_SIZE);
  assert.equal(payload.hasMore, true);
  assert.ok(requested.some((url) => url.includes("page=2")), "should spill onto upstream page 2");
});

test("kolnovel catalog accepts latin genre filters", async () => {
  const { responseCache } = await import("../lib/httpUtils.js");
  const originalFetch = globalThis.fetch;
  responseCache.clear();
  const catalogHtml = `
    <article class="maindet">
      <h2 itemprop="headline"><a href="https://kolnovel.com/series/novel-a/" title="Novel A">Novel A</a></h2>
      <span class="mdgenre"><a href="https://kolnovel.com/genre/action/"># أكشن</a></span>
      <div class="contexcerpt"><p>رواية أ مترجمة Novel A</p></div>
      <img class="ts-post-image" src="https://kolnovel.com/cover.jpg" />
      <div class="mdinfodet">
        <span class="nchapter"><a href="https://kolnovel.com/shaag24novel-a-az435ggye-12/"><i></i> الفصل 12</a></span>
      </div>
    </article>
  `;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/series/")) {
      assert.match(target, /genre(?:%5B%5D|\[\])=action/);
      return {
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        async text() {
          return catalogHtml;
        },
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => "text/html" },
      async text() {
        return "<html></html>";
      },
    };
  };
  try {
    const { handleKolnovelRequest } = await import("../sources/kolnovel.js");
    const url = new URL("https://api.local/sources/kolnovel/catalog?page=1&genre=action");
    const result = await handleKolnovelRequest(url);
    assert.equal(result.status, 200);
    assert.ok(result.body.items.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
    responseCache.clear();
  }
});

test("extractKolnovelChapterNumber prefers الفصل over season number", () => {
  assert.equal(extractKolnovelChapterNumber("الموسم 1 الفصل 35"), "35");
  assert.equal(extractKolnovelChapterNumber(" الموسم 1 الفصل 1"), "1");
  assert.equal(extractKolnovelChapterNumber("خيارات (2)", ""), "2");
});

test("parseKolnovelChapters merges all eplister volume blocks", () => {
  const html = `
    <div class="eplister">
      <ul>
        <li>
          <a href="https://kolnovel.com/shaag24novel-az435ggye-22/">
            <div class="epl-num">الفصل 2</div>
            <div class="epl-title">الثاني</div>
          </a>
        </li>
      </ul>
    </div>
    <span class="ts-chl-collapsible">الكتاب الثاني</span>
    <div class="ts-chl-collapsible-content">
      <div class="eplister">
        <ul>
          <li>
            <a href="https://kolnovel.com/shaag24novel-az435ggye-11/">
              <div class="epl-num">الفصل 1</div>
            </a>
          </li>
        </ul>
      </div>
    </div>
  `;
  const chapters = parseKolnovelChapters(html, "https://kolnovel.com/series/novel-a/");
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "2");
  assert.equal(chapters[1].number, "1");
});

test("parseKolnovelChapters keeps newest chapter first", () => {
  const html = `
    <div class="eplister">
      <ul>
        <li>
          <a href="https://kolnovel.com/shaag24novel-az435ggye-22/">
            <div class="epl-num">الفصل 2</div>
            <div class="epl-title">الثاني</div>
            <div class="epl-date">Jan 1, 2025</div>
          </a>
        </li>
        <li>
          <a href="https://kolnovel.com/shaag24novel-az435ggye-11/">
            <div class="epl-num">الفصل 1</div>
          </a>
        </li>
      </ul>
    </div>
  `;
  const chapters = parseKolnovelChapters(html, "https://kolnovel.com/series/novel-a/");
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "2");
  assert.equal(chapters[1].number, "1");
});

test("catalogHasMorePages detects kolnovel hpage Next link", () => {
  const html = `
    <article class="maindet"></article>
    <div class="hpage">
      <a href="?page=2&status=&order=latest" class="r">Next <i class="fa fa-angle-right"></i></a>
    </div>
  `;
  assert.equal(catalogHasMorePages(html, 1), true);
  assert.equal(catalogHasMorePages(html, 2), false);
});

test("parseParadiseChapter works for kolnovel epcontent", () => {
  const html = `
    <div class="epcontent entry-content">
      <p>نص الفصل الأول.</p>
      <p>فقرة ثانية.</p>
    </div>
  `;
  const chapter = parseParadiseChapter(html, "https://kolnovel.com/shaag24novel-az435ggye-1/");
  assert.equal(chapter.paragraphs.length, 2);
});

test("extractParadiseParagraphs keeps kolnovel hash paragraphs in reading order", () => {
  const html = `
    <blockquote><p style="text-align: center;">قرمزي.</p></blockquote>
    <p class='ac4959551818761eb93e81e5a73db50cb' dir="rtl">01: قرمزي.<p class="a104bfdbe6368b4d68cbc1468a27e1e43">نص خاطئ</p></p>
    <p class='acecda57cac394bff8926d30f8c172e65' dir="rtl">&#8216;مؤلم!&#8217;<p class="a429fc78ecb608cea800af42fc5c2f384">نص آخر خاطئ</p></p>
    <p class='a3c88ef0bff9e27146cb326431c2be33d' dir="rtl">عالم الأحلام المذهل و المبهرج المملوء بالتمتمات تحطم في لحظة.<p class="a5cb8ed37aabae20e0928acbc51e00dd7">فقرة داخلية خاطئة</p></p>
    <div class="shola-widget">widget</div>
  `;
  const paragraphs = extractParadiseParagraphs(html);
  assert.equal(paragraphs[0], "قرمزي.");
  assert.equal(paragraphs[1], "01: قرمزي.");
  assert.match(paragraphs[2], /مؤلم/);
  assert.match(paragraphs[3], /عالم الأحلام المذهل/);
  assert.ok(!paragraphs.some((paragraph) => /widget|نص خاطئ|فقرة داخلية/.test(paragraph)));
});

test("extractParadiseParagraphs keeps kolnovel scrambled chapters readable", () => {
  const html = `
    <div class="epcontent entry-content">
      <blockquote><p style="text-align: center;">لكل سبب نتيجة</p></blockquote>
      <p class='outer-a'>لكل سبب نتيجة<p class="inner-a">“ادخل لرؤيته بسرعة!”</p>
      <p class='outer-b'>—-<p class="inner-b">“ومن أجل رؤيتك للمرة الأخيرة، أشعل بالفعل مصباح النجوم السبعة.”</p>
      <p class='outer-c'>مرّ الزمن مسرعًا كالسهم المنطلق من الوتر.<p class="inner-c">“فسيجلب محنة حتمًا.”</p>
      <p class='outer-d'>وفي غمضة عين، انقضت ثلاثون سنة أخرى.<p class="inner-d">“الإنجاز الصغير قد يمر بلا مشكلة.”</p>
      <p class='outer-e'>حين فتح لو يانغ عينيه من جديد.<p class="inner-e">“في لمح البصر… بلغت الثمانين بالفعل.”</p>
    </div>
  `;
  const block = html.match(/<div class="epcontent entry-content">([\s\S]*?)<\/div>/i)?.[1] ?? "";
  const paragraphs = extractParadiseParagraphs(block);
  assert.ok(paragraphs.length >= 4);
  assert.equal(paragraphs[0], "لكل سبب نتيجة");
  assert.equal(paragraphs[1], "—-");
  assert.match(paragraphs[2], /مرّ الزمن مسرعًا/);
  assert.match(paragraphs[3], /وفي غمضة عين/);
  assert.ok(!paragraphs.some((paragraph) => paragraph.includes("لكل سبب نتيجة ادخل")));
});

test("extractParadiseParagraphs merges kolnovel span paragraphs", () => {
  const html = `
    <p class='outer-a'><span style="font-weight: 400;">فقرة كاملة من البداية.</span><p class="inner-a">وتستمر الفقرة هنا.</p>
    <p class='outer-b'><span>فقرة ثانية.</span></p>
  `;
  const paragraphs = extractParadiseParagraphs(html);
  assert.equal(paragraphs.length, 2);
  assert.match(paragraphs[0], /فقرة كاملة من البداية/);
  assert.match(paragraphs[0], /وتستمر الفقرة هنا/);
  assert.equal(paragraphs[1], "فقرة ثانية.");
});
