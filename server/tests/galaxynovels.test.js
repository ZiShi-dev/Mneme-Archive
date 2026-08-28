import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGalaxyAuthorFilterEntries,
  galaxyAuthorFilterEntry,
  handleGalaxyRequest,
  normalizeGalaxyAuthorName,
  parseGalaxyCatalogNovelIds,
  parseGalaxyChapter,
  parseGalaxyChapterApi,
} from "../sources/galaxynovels.js";

test("parseGalaxyCatalogNovelIds reads library novel ids", () => {
  const html = `
    <article data-wor-library-novel-id="48220"></article>
    <article data-wor-library-novel-id="313293"></article>
    <article data-wor-library-novel-id="48220"></article>
  `;
  assert.deepEqual(parseGalaxyCatalogNovelIds(html), [48220, 313293]);
});

test("buildGalaxyAuthorFilterEntries sorts and filters invalid authors", () => {
  const entries = buildGalaxyAuthorFilterEntries(new Map([
    ["Li Ming C", 2],
    ["غير متوفر", 4],
    ["Hei Zhi Zhu", 1],
  ]));
  assert.equal(entries.length, 2);
  assert.equal(entries[0].name, "Hei Zhi Zhu");
  assert.equal(entries[1].name, "Li Ming C");
  assert.equal(entries[1].count, 2);
  assert.equal(entries[1].queryParam, "author");
});

test("normalizeGalaxyAuthorName strips markup noise", () => {
  assert.equal(normalizeGalaxyAuthorName(" <span>Li Ming C</span> "), "Li Ming C");
});

test("galaxyAuthorFilterEntry builds catalog filter payload", () => {
  assert.deepEqual(galaxyAuthorFilterEntry("Li Ming C", 3), {
    slug: "li-ming-c",
    name: "Li Ming C",
    count: 3,
    filterPath: "/library/",
    queryParam: "author",
    queryValue: "Li Ming C",
  });
});

test("galaxynovels filters expose all catalog authors", { timeout: 120_000 }, async () => {
  const result = await handleGalaxyRequest(new URL("http://local/api/sources/galaxynovels/filters"));
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.authors));
  assert.ok(result.body.authors.length > 20, `expected many authors, got ${result.body.authors.length}`);
  const liMing = result.body.authors.find((entry) => entry.name === "Li Ming C");
  assert.ok(liMing);
  assert.ok(liMing.count >= 1);
});

test("galaxynovels catalog author filter uses library search", async () => {
  const result = await handleGalaxyRequest(new URL(
    "http://local/api/sources/galaxynovels/catalog?page=1&filterPath=%2Flibrary%2F&queryParam=author&queryValue=Li%20Ming%20C",
  ));
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.items));
  assert.ok(result.body.items.some((item) => item.id === "netherils-brilliance"));
});

test("galaxynovels catalog cards expose clickable recent chapters", { timeout: 60_000 }, async () => {
  const result = await handleGalaxyRequest(new URL("http://local/api/sources/galaxynovels/catalog?page=1"));
  assert.equal(result.status, 200);
  assert.ok(result.body.items.length > 0);
  const withChapters = result.body.items.filter((item) => item.recentChapters?.some((chapter) => chapter.url));
  assert.ok(withChapters.length > 0, "expected catalog items with chapter urls");
  assert.match(withChapters[0].recentChapters[0].url, /\/chapter-/i);
});

test("galaxynovels manga details include author for netherils-brilliance", async () => {
  const result = await handleGalaxyRequest(new URL(
    "http://local/api/sources/galaxynovels/manga?url=https%3A%2F%2Fgalaxynovels.com%2Fnovel%2Fnetherils-brilliance%2F",
  ));
  assert.equal(result.status, 200);
  assert.equal(result.body.author, "Li Ming C");
  assert.ok(result.body.chapters.length > 0);
  assert.equal(result.body.chapters[0].author, "Li Ming C");
});

test("parseGalaxyChapter reads wor-reader-text-surface paragraphs", () => {
  const html = `
    <article class="wor-reading-page" data-chapter-title="الفصل 1: اختبار">
      <h1 itemprop="headline">الفصل 1: اختبار</h1>
      <noscript><div class="wor-js-required">يرجى تفعيل JavaScript لمتابعة القراءة.</div></noscript>
      <div class="wor-reader-text-surface" itemprop="text" data-wor-reader-text>
        <p>فقرة اختبار أولى</p>
        <p>فقرة اختبار ثانية</p>
      </div>
    </article>
  `;
  const parsed = parseGalaxyChapter(html, "https://galaxynovels.com/novel/demo/chapter-1/");
  assert.equal(parsed.title, "الفصل 1: اختبار");
  assert.deepEqual(parsed.paragraphs, ["فقرة اختبار أولى", "فقرة اختبار ثانية"]);
});

test("parseGalaxyChapter still reads legacy wor-reading-page__content", () => {
  const html = `
    <article class="wor-reading-page" data-chapter-title="فصل قديم">
      <div class="wor-reading-page__content"><p>نص قديم</p></div>
    </article>
  `;
  const parsed = parseGalaxyChapter(html, "https://galaxynovels.com/novel/demo/chapter-1/");
  assert.deepEqual(parsed.paragraphs, ["نص قديم"]);
});

test("parseGalaxyChapterApi reads content_html paragraphs", () => {
  const parsed = parseGalaxyChapterApi({
    data: {
      display_title: "فصل واجهة",
      url: "/novel/demo/chapter-2/",
      content_html: "<p>من الواجهة</p><p>فقرة تالية</p>",
    },
  }, "https://galaxynovels.com/novel/demo/chapter-2/");
  assert.equal(parsed.title, "فصل واجهة");
  assert.equal(parsed.url, "https://galaxynovels.com/novel/demo/chapter-2/");
  assert.deepEqual(parsed.paragraphs, ["من الواجهة", "فقرة تالية"]);
});

test("galaxynovels chapter route accepts three-part urls and returns paragraphs", { timeout: 60_000 }, async () => {
  const details = await handleGalaxyRequest(new URL(
    "http://local/api/sources/galaxynovels/manga?url=https%3A%2F%2Fgalaxynovels.com%2Fnovel%2Fnetherils-brilliance%2F",
  ));
  assert.equal(details.status, 200);
  const chapter = [...details.body.chapters].sort((a, b) => Number(a.number) - Number(b.number))[0];
  assert.ok(chapter?.url);
  const result = await handleGalaxyRequest(new URL(
    `http://local/api/sources/galaxynovels/chapter?url=${encodeURIComponent(chapter.url)}`,
  ));
  assert.equal(result.status, 200);
  assert.equal(result.body.kind, "novel");
  assert.ok(result.body.paragraphs.length > 2, `expected chapter paragraphs, got ${result.body.paragraphs.length}`);
});
