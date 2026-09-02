import test from "node:test";
import assert from "node:assert/strict";
import {
  assertChapterUrl,
  CENELE_CATALOG_PAGE_SIZE,
  fetchCeneleCatalogPage,
  isCeneleChapterLocked,
  parseCeneleCatalog,
  parseCeneleChapter,
  parseCeneleChapterRows,
  parseCeneleDetails,
} from "../sources/cenele.js";

function upstreamCatalogHtml(count, page, { hasNext = true } = {}) {
  const cards = Array.from({ length: count }, (_, index) => {
    const id = `novel-${page}-${index + 1}`;
    const chapterCount = page * 10 + index + 1;
    return `
      <article class="nhv-library-card">
        <div class="nhv-library-card__body">
          <h2 class="nhv-library-card__title"><a href="https://cenele.com/cont/${id}/">رواية ${id}</a></h2>
          <span class="nhv-library-card__chip">${chapterCount} فصل</span>
        </div>
      </article>
    `;
  }).join("");
  const nextLink = hasNext ? `<a href="https://cenele.com/cont/page/${page + 1}/">التالي</a>` : "";
  return `${cards}${nextLink}`;
}

test("parseCeneleCatalog reads nhv-library-card entries", () => {
  const html = `
    <article class="nhv-library-card">
      <a class="nhv-library-card__cover" href="https://cenele.com/cont/novel-a/">
        <img class="wp-post-image" src="https://cenele.com/wp-content/uploads/cover.webp" />
      </a>
      <div class="nhv-library-card__body">
        <h2 class="nhv-library-card__title"><a href="https://cenele.com/cont/novel-a/">رواية أ</a></h2>
        <span class="nhv-library-card__chip">12 فصل</span>
        <p class="nhv-library-card__excerpt">ملخص قصير</p>
      </div>
    </article>
  `;
  const items = parseCeneleCatalog(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "رواية أ");
  assert.equal(items[0].latestChapter, "12");
  assert.equal(items[0].recentChapters.length, 0);
  assert.equal(items[0].latestChapterUrl, null);
  assert.equal(items[0].id, "novel-a");
});

test("CENELE_CATALOG_PAGE_SIZE matches Realm Novel / MangaLik density", () => {
  assert.equal(CENELE_CATALOG_PAGE_SIZE, 24);
});

test("fetchCeneleCatalogPage returns 24 catalog items like Realm Novel", async () => {
  const requested = [];
  const fetchHtml = async (url) => {
    requested.push(url);
    if (url.endsWith("/cont/") || url.endsWith("/cont/page/1/")) return upstreamCatalogHtml(10, 1);
    if (url.endsWith("/cont/page/2/")) return upstreamCatalogHtml(10, 2, { hasNext: true });
    if (url.endsWith("/cont/page/3/")) return upstreamCatalogHtml(10, 3, { hasNext: true });
    return upstreamCatalogHtml(10, 4, { hasNext: false });
  };

  const ctx = { baseUrl: "https://cenele.com" };
  const payload = await fetchCeneleCatalogPage(ctx, fetchHtml, { page: 1 });
  assert.equal(payload.items.length, CENELE_CATALOG_PAGE_SIZE);
  assert.equal(payload.hasMore, true);
  assert.ok(requested.some((url) => url.includes("/cont/page/2/")), "should spill onto upstream page 2");
});

test("fetchCeneleCatalogPage enriches catalog cards with real chapter urls", async () => {
  const catalogHtml = `
    <article class="nhv-library-card">
      <div class="nhv-library-card__body">
        <h2 class="nhv-library-card__title"><a href="https://cenele.com/cont/novel-a/">رواية أ</a></h2>
        <span class="nhv-library-card__chip">12 فصل</span>
      </div>
    </article>
  `;
  const novelHtml = `
    <article class="nhv-novel-hero post-104602">
      <h1 class="nhv-novel-title">رواية أ</h1>
    </article>
    <li data-chapter-id="1" class="wp-manga-chapter">
      <a href="https://cenele.com/cont/novel-a/vol/الفصل-12/">الفصل 12</a>
    </li>
    <li data-chapter-id="2" class="wp-manga-chapter">
      <a href="https://cenele.com/cont/novel-a/vol/الفصل-11/">الفصل 11</a>
    </li>
  `;
  const fetchHtml = async (url) => {
    if (url.includes("/cont/novel-a")) return novelHtml;
    return catalogHtml;
  };

  const ctx = { baseUrl: "https://cenele.com" };
  const payload = await fetchCeneleCatalogPage(ctx, fetchHtml, { page: 1 });
  const item = payload.items.find((entry) => entry.id === "novel-a");
  assert.ok(item, "novel-a should be present");
  assert.equal(item.latestChapter, "12");
  assert.match(item.recentChapters[0]?.url, /\/cont\/novel-a\/vol\/.*12\/?$/i);
});

test("fetchCeneleCatalogPage slices the second app page across upstream pages", async () => {
  const fetchHtml = async (url) => {
    if (url.endsWith("/cont/page/3/")) return upstreamCatalogHtml(10, 3);
    if (url.endsWith("/cont/page/4/")) return upstreamCatalogHtml(10, 4);
    if (url.endsWith("/cont/page/5/")) return upstreamCatalogHtml(10, 5);
    if (url.endsWith("/cont/page/6/")) return upstreamCatalogHtml(10, 6, { hasNext: false });
    return upstreamCatalogHtml(10, 1);
  };

  const ctx = { baseUrl: "https://cenele.com" };
  const payload = await fetchCeneleCatalogPage(ctx, fetchHtml, { page: 2 });
  assert.equal(payload.items.length, CENELE_CATALOG_PAGE_SIZE);
  assert.equal(payload.items[0].id, "novel-3-5");
});

test("parseCeneleCatalog accepts relative novel links", () => {
  const html = `
    <article class="nhv-library-card">
      <div class="nhv-library-card__body">
        <h2 class="nhv-library-card__title"><a href="/cont/novel-b/">رواية ب</a></h2>
      </div>
    </article>
  `;
  const items = parseCeneleCatalog(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "رواية ب");
  assert.match(items[0].url, /\/cont\/novel-b\//);
});

test("assertChapterUrl accepts direct and vol chapter paths", () => {
  const direct = assertChapterUrl("https://cenele.com/cont/my-mh-mam/%d8%a7%d9%84%d9%81%d8%b5%d9%84-327/");
  assert.match(direct, /\/cont\/my-mh-mam\/.*327\/?$/i);
  const vol = assertChapterUrl("https://cenele.com/cont/novel-a/vol/الفصل-2/");
  assert.match(vol, /\/cont\/novel-a\/vol\/.*2\/?$/i);
  const shortVol = assertChapterUrl("https://cenele.com/cont/novel-a/v/الفصل-1/");
  assert.match(shortVol, /\/cont\/novel-a\/v\/.*1\/?$/i);
  assert.throws(() => assertChapterUrl("https://cenele.com/cont/novel-a/"), /غير صالح/);
});

test("assertChapterUrl accepts all Cenele chapter URL formats", () => {
  const accepted = [
    ["direct encoded", "https://cenele.com/cont/my-mh-mam/%d8%a7%d9%84%d9%81%d8%b5%d9%84-327/"],
    ["direct unicode", "https://cenele.com/cont/bastard-of-clan/الفصل-55/"],
    ["direct no trailing slash", "https://cenele.com/cont/my-mh-mam/الفصل-327"],
    ["volume slug + chapter", "https://cenele.com/cont/rear-moon/%d8%a7%d9%84%d9%85%d8%ac%d9%84%d8%af-%d8%a7%d9%84%d8%ab%d8%a7%d9%84%d8%ab-%d9%88%d8%b9%d8%b4%d8%b1%d9%88%d9%86-23/%d8%a7%d9%84%d9%81%d8%b5%d9%84-564/"],
    ["vol path", "https://cenele.com/cont/novel-a/vol/الفصل-2/"],
    ["v path", "https://cenele.com/cont/novel-a/v/الفصل-1/"],
    ["english slug", "https://cenele.com/cont/novel-a/chapter-5/"],
    ["short arabic slug", "https://cenele.com/cont/novel-a/فصل-10/"],
    ["decimal chapter", "https://cenele.com/cont/novel-a/الفصل-12.5/"],
    ["www host", "https://www.cenele.com/cont/my-mh-mam/%d8%a7%d9%84%d9%81%d8%b5%d9%84-327/"],
  ];
  for (const [label, url] of accepted) {
    assert.doesNotThrow(() => assertChapterUrl(url), label);
  }

  const rejected = [
    ["novel page", "https://cenele.com/cont/novel-a/"],
    ["catalog", "https://cenele.com/cont/"],
    ["feed", "https://cenele.com/cont/my-mh-mam/feed/"],
    ["volume index", "https://cenele.com/cont/rear-moon/%d8%a7%d9%84%d9%85%d8%ac%d9%84%d8%af-%d8%a7%d9%84%d8%ab%d8%a7%d9%84%d8%ab-%d9%88%d8%b9%d8%b4%d8%b1%d9%88%d9%86-23/"],
    ["random slug", "https://cenele.com/cont/novel-a/some-random-slug/"],
    ["wrong host", "https://evil.com/cont/novel-a/vol/الفصل-1/"],
  ];
  for (const [label, url] of rejected) {
    assert.throws(() => assertChapterUrl(url), /غير صالح|غير مسموح/, label);
  }
});

test("parseCeneleChapterRows reads wp-manga-chapter list", () => {
  const html = `
    <li data-chapter-id="1" class="wp-manga-chapter">
      <a href="https://cenele.com/cont/novel-a/vol/الفصل-2/">الفصل 2 <span class="nhv-chapter-name">الثاني</span></a>
      <span class="chapter-release-date">Jan 1</span>
    </li>
    <li data-chapter-id="2" class="wp-manga-chapter">
      <a href="https://cenele.com/cont/novel-a/vol/الفصل-1/">الفصل 1</a>
    </li>
  `;
  const chapters = parseCeneleChapterRows(html);
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "2");
  assert.equal(chapters[1].number, "1");
});

test("parseCeneleDetails merges chapter list", () => {
  const html = `
    <article class="nhv-novel-hero post-104602">
      <h1 class="nhv-novel-title">رواية تجريبية</h1>
      <div class="nhv-novel-cover"><img src="https://cenele.com/wp-content/uploads/cover.webp" /></div>
      <div class="nhv-novel-synopsis"><h2>عنوان</h2><p>ملخص الرواية</p></div>
    </article>
  `;
  const chapters = [
    { url: "https://cenele.com/cont/novel-a/v/الفصل-2/", name: "2", number: "2", date: "", locked: false },
    { url: "https://cenele.com/cont/novel-a/v/الفصل-1/", name: "1", number: "1", date: "", locked: false },
  ];
  const details = parseCeneleDetails(html, "https://cenele.com/cont/novel-a/", chapters);
  assert.equal(details.title, "رواية تجريبية");
  assert.equal(details.chapters.length, 2);
  assert.equal(details.latestChapter, "2");
});

test("parseCeneleChapter extracts reading paragraphs", () => {
  const html = `
    <div id="chapter-1" class="reading-content">
      <div class="nhv-reading-chapter-head"><h3 class="chapter-name">الفصل 1</h3></div>
      <p>الفصل 1: البداية</p>
      <p>نص الفصل الأول.</p>
    </div>
  `;
  const chapter = parseCeneleChapter(html, "https://cenele.com/cont/novel-a/v/الفصل-1/");
  assert.equal(chapter.paragraphs.length, 2);
  assert.match(chapter.paragraphs[1], /نص الفصل/);
});

test("parseCeneleChapter reports locked chapters clearly", () => {
  const html = `
    <div class="reading-content">
      <p>سجّل حسابك لتجربة أفضل</p>
    </div>
  `;
  assert.throws(
    () => parseCeneleChapter(html, "https://cenele.com/cont/novel-a/الفصل-99/"),
    /مقفول|تسجيل الدخول/,
  );
});

test("parseCeneleChapterRows reads فصل slug numbers", () => {
  const html = `
    <li data-chapter-id="1" class="wp-manga-chapter">
      <a href="https://cenele.com/cont/novel-a/فصل-10/">فصل 10</a>
    </li>
  `;
  const chapters = parseCeneleChapterRows(html);
  assert.equal(chapters[0].number, "10");
});
