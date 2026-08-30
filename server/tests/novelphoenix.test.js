import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChapterUrl,
  buildNovelUrl,
  buildNovelphoenixCatalogUrl,
  buildNovelphoenixSearchUrl,
  catalogHasMorePages,
  handleNovelphoenixRequest,
  novelphoenixCatalogHtmlLooksValid,
  parseChapterTarget,
  parseNovelphoenixCatalog,
  parseNovelphoenixChapter,
  parseNovelphoenixChapters,
  parseNovelphoenixDetails,
  extractNovelphoenixContentHtml,
  slugFromNovelUrl,
} from "../sources/novelphoenix.js";

test("slugFromNovelUrl and parseChapterTarget", () => {
  assert.equal(slugFromNovelUrl("https://novelphoenix.com/novel/shadow-slave"), "shadow-slave");
  assert.deepEqual(
    parseChapterTarget("https://novelphoenix.com/novel/shadow-slave/chapter-12"),
    { slug: "shadow-slave", chapterNumber: 12 },
  );
});

test("buildNovelphoenixCatalogUrl maps genre, tag and kind presets", () => {
  assert.equal(
    buildNovelphoenixCatalogUrl({ page: 1 }),
    "https://novelphoenix.com/genre-all/sort-new/status-all/all-novel",
  );
  assert.equal(
    buildNovelphoenixCatalogUrl({ page: 2, genre: "fantasy" }),
    "https://novelphoenix.com/genre-fantasy/sort-new/status-all/all-novel?page=2",
  );
  assert.equal(
    buildNovelphoenixCatalogUrl({ tag: "fanfiction" }),
    "https://novelphoenix.com/tags/fanfiction/order-popular",
  );
  assert.equal(
    buildNovelphoenixCatalogUrl({ kind: "ranking" }),
    "https://novelphoenix.com/ranking",
  );
});

test("parseNovelphoenixCatalog reads novel cards", () => {
  const html = `
    <ul class="novel-list col6">
      <li class="novel-item"><a title="Shadow Slave" href="/novel/shadow-slave">
        <figure class="novel-cover"><img data-src="/server-1/shadow-slave.jpg" alt="Shadow Slave"></figure>
        <h4 class="novel-title text2row">Shadow Slave</h4>
      </a><div class="novel-stats"><i class="icon-book-open"></i> 3166 Chapters</div></li>
    </ul>
  `;
  const items = parseNovelphoenixCatalog(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Shadow Slave");
  assert.equal(items[0].url, buildNovelUrl("shadow-slave"));
  assert.equal(items[0].cover, "https://novelphoenix.com/server-1/shadow-slave.jpg");
});

test("parseNovelphoenixCatalog accepts absolute novel urls", () => {
  const html = `
    <li class="novel-item">
      <a title="Shadow Slave" href="https://novelphoenix.com/novel/shadow-slave">
        <h4 class="novel-title text2row">Shadow Slave</h4>
      </a>
    </li>
  `;
  const items = parseNovelphoenixCatalog(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "shadow-slave");
});

test("novelphoenixCatalogHtmlLooksValid rejects cloudflare pages", () => {
  assert.equal(novelphoenixCatalogHtmlLooksValid('<html><title>Just a moment...</title></html>'), false);
  assert.equal(novelphoenixCatalogHtmlLooksValid('<ul><li class="novel-item"></li></ul>'), true);
});

test("handleNovelphoenixRequest catalog returns novels", async () => {
  const result = await handleNovelphoenixRequest(new URL("https://api.local/sources/novelphoenix/catalog?page=1"));
  assert.equal(result.status, 200);
  assert.ok(result.body.items.length > 0);
});

test("parseNovelphoenixChapters reads chapter list", () => {
  const html = `
    <ul class="chapter-list">
      <li><a href="/novel/shadow-slave/chapter-2" title="Chapter 2">
        <span class="chapter-no">2</span><strong class="chapter-title">Chapter 2 - Slave Caravan</strong>
        <time datetime="2022-06-02">4 years ago</time>
      </a></li>
      <li><a href="/novel/shadow-slave/chapter-1" title="Chapter 1">
        <span class="chapter-no">1</span><strong class="chapter-title">Chapter 1 - Nightmare Begins</strong>
      </a></li>
    </ul>
  `;
  const chapters = parseNovelphoenixChapters(html, "shadow-slave");
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "2");
  assert.equal(chapters[1].url, buildChapterUrl("shadow-slave", 1));
});

test("parseNovelphoenixDetails and chapter content", () => {
  const detailsHtml = `
    <h1 class="novel-title text2row">Shadow Slave</h1>
    <div class="summary"><p>Growing up in poverty.</p></div>
    <div class="categories"><h4>Genres</h4><ul>
      <li><a href="/genre-fantasy/sort-new/status-all/all-novel" title="Fantasy">Fantasy</a></li>
    </ul></div>
    <figure class="novel-cover"><img src="/server-1/shadow-slave.jpg"></figure>
  `;
  const details = parseNovelphoenixDetails(detailsHtml, "https://novelphoenix.com/novel/shadow-slave");
  assert.equal(details.title, "Shadow Slave");
  assert.deepEqual(details.categories, ["Fantasy"]);

  const chapter = parseNovelphoenixChapter(
    `<h1>Shadow Slave - Chapter 1</h1><div id="content"><div><table><tr><td>note</td></tr></table></div><p>First line.</p><p>Second line.</p></div></footer>`,
    buildChapterUrl("shadow-slave", 1),
  );
  assert.deepEqual(chapter.paragraphs, ["First line.", "Second line."]);
});

test("extractNovelphoenixContentHtml keeps nested div content", () => {
  const html = '<div id="content"><div><p>Inside nested div.</p></div></div></footer>';
  const content = extractNovelphoenixContentHtml(html);
  assert.match(content, /Inside nested div/);
});

test("catalogHasMorePages and search url", () => {
  assert.equal(catalogHasMorePages('<li class="page-item"><a class="page-link" href="?page=2">2</a></li>'), true);
  assert.equal(
    buildNovelphoenixSearchUrl("shadow slave", 2),
    "https://novelphoenix.com/search?keyword=shadow+slave&type=novel&page=2",
  );
});
