import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCeneleCatalog,
  parseCeneleChapter,
  parseCeneleChapterRows,
  parseCeneleDetails,
} from "../sources/cenele.js";

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
  assert.equal(items[0].recentChapters.length, 2);
  assert.equal(items[0].recentChapters[0].number, "12");
  assert.equal(items[0].recentChapters[1].number, "11");
  assert.equal(items[0].id, "novel-a");
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
