import test from "node:test";
import assert from "node:assert/strict";
import {
  novelIdFromUrl,
  parseRealmCatalog,
  parseRealmChapter,
  parseRealmDetails,
  parseRealmMoreCatalog,
} from "../sources/realmnovel.js";

test("novelIdFromUrl reads novel and chapter paths", () => {
  assert.deepEqual(
    novelIdFromUrl("https://realmnovel.com/novel/690f7c85419b78c5ab0ef3d0/chapter/3"),
    { novelId: "690f7c85419b78c5ab0ef3d0", chapterNumber: 3 },
  );
});

test("parseRealmCatalog reads g3card entries", () => {
  const html = `
    <a class="g3card" href="/novel/690f7c85419b78c5ab0ef3d0">
      <img src="/img/novel/690f7c85419b78c5ab0ef3d0.jpg" />
      <span class="g3chaps">📖 12</span>
      <div class="g3title">رواية أ</div>
      <div class="g3sub">Novel A</div>
    </a>
  `;
  const items = parseRealmCatalog(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "رواية أ");
  assert.equal(items[0].latestChapter, "12");
});

test("parseRealmMoreCatalog reads JSON docs", () => {
  const items = parseRealmMoreCatalog({
    docs: [{
      id: "690f7c85419b78c5ab0ef3d0",
      title: "رواية",
      titleEn: "Novel",
      chapters: 675,
    }],
    hasMore: true,
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].latestChapter, "675");
});

test("parseRealmDetails marks locked chapters", () => {
  const html = `
    <article class="novel-head">
      <button data-fav-btn data-chapters="100"></button>
      <h1 class="h1">رواية</h1>
      <h2 class="sub">Novel</h2>
      <img src="/img/novel/690f7c85419b78c5ab0ef3d0.jpg" />
      <p class="desc">ملخص</p>
      <span class="badge">مستمرة</span>
      <span class="badge">100 فصل</span>
      <a class="tag" href="/?tag=اكشن">اكشن</a>
    </article>
    <a class="chapter-row " href="/novel/690f7c85419b78c5ab0ef3d0/chapter/1"><span>1</span></a>
    <a class="chapter-row is-locked" href="/novel/690f7c85419b78c5ab0ef3d0/chapter/51"><span>51</span></a>
  `;
  const details = parseRealmDetails(html, "690f7c85419b78c5ab0ef3d0");
  assert.equal(details.chapters.length, 100);
  assert.equal(details.chapters[0].locked, false);
  assert.equal(details.chapters[50].locked, true);
});

test("parseRealmChapter extracts paragraphs", () => {
  const chapter = parseRealmChapter(
    `<h1 class="h1">الفصل 1</h1><div class="chapter-content"><p>أول.</p><p>ثاني.</p></div>`,
    "https://realmnovel.com/novel/690f7c85419b78c5ab0ef3d0/chapter/1",
  );
  assert.deepEqual(chapter.paragraphs, ["أول.", "ثاني."]);
});

test("parseRealmChapter rejects locked page", () => {
  assert.throws(
    () => parseRealmChapter('<div class="locked"><h1>الفصل 51 غير متاح على الموقع</h1></div>', "https://realmnovel.com/novel/x/chapter/51"),
    /Sky Novel/,
  );
});
