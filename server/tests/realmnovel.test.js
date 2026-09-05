import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRealmChapterAccess,
  buildRealmFiltersFromDocs,
  isRealmChapterWebLocked,
  novelIdFromUrl,
  parseRealmCatalog,
  parseRealmChapter,
  parseRealmDetails,
  parseRealmFollowLatest,
  parseRealmMoreCatalog,
  sanitizeRealmChapterLabel,
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
      category: "مترجمة",
      tags: ["اكشن", "سحر"],
    }],
    hasMore: true,
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].latestChapter, "675");
  assert.deepEqual(items[0].recentChapters.map((entry) => entry.number), ["675", "674"]);
  assert.deepEqual(items[0].categories, ["مترجمة"]);
  assert.deepEqual(items[0].tags, ["اكشن", "سحر"]);
});

test("buildRealmFiltersFromDocs exposes type categories and genre tags", () => {
  const filters = buildRealmFiltersFromDocs([
    { category: "مترجمة", tags: ["اكشن", "سحر"] },
    { category: "مؤلفة", tags: ["اكشن"] },
    { category: "مترجمة", tags: ["سحر"] },
  ]);
  assert.ok(filters.categories.some((entry) => entry.slug === "مترجمة" && entry.count === 2));
  assert.ok(filters.categories.some((entry) => entry.slug === "مؤلفة"));
  assert.ok(filters.categories.some((entry) => entry.slug === "اكشن" && entry.count === 2));
  assert.equal(filters.tags.find((entry) => entry.slug === "سحر")?.count, 2);
});

test("sanitizeRealmChapterLabel strips lock markers from chapter titles", () => {
  assert.equal(sanitizeRealmChapterLabel("5265 — الفصل 5265 🔒"), "5265 — الفصل 5265");
  assert.equal(sanitizeRealmChapterLabel("🔒 الفصل 51"), "الفصل 51");
});

test("parseRealmDetails strips lock emoji from locked chapter rows", () => {
  const html = `
    <article class="novel-head">
      <button data-fav-btn data-chapters="52"></button>
      <h1 class="h1">رواية</h1>
      <img src="/img/novel/690f7c85419b78c5ab0ef3d0.jpg" />
    </article>
    <a class="chapter-row is-locked" href="/novel/690f7c85419b78c5ab0ef3d0/chapter/51"><span>51 — الفصل 51 🔒</span></a>
  `;
  const details = parseRealmDetails(html, "690f7c85419b78c5ab0ef3d0");
  assert.equal(details.chapters.find((chapter) => chapter.number === "51")?.name, "51 — الفصل 51");
  assert.ok(details.chapters.every((chapter) => !chapter.name.includes("🔒")));
});

test("parseRealmDetails extends chapter list and keeps every chapter readable", () => {
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
  assert.equal(details.chapters[49].locked, false);
  assert.equal(details.chapters[50].locked, false);
  assert.equal(details.chapters[50].lockReason, undefined);
  assert.ok(details.chapters.every((chapter) => chapter.locked === false));
});

test("parseRealmFollowLatest reads head only without full chapter list", () => {
  const html = `
    <article class="novel-head">
      <button data-fav-btn data-chapters="2365"></button>
      <h1 class="h1">سيد الحقيقة</h1>
      <h2 class="sub">Lord of Mysteries</h2>
      <img src="/img/novel/690f7c85419b78c5ab0ef3d0.jpg" />
    </article>
  `;
  const details = parseRealmFollowLatest(html, "690f7c85419b78c5ab0ef3d0");
  assert.equal(details.title, "سيد الحقيقة");
  assert.equal(details.chapters.length, 1);
  assert.equal(details.chapters[0].number, "2365");
  assert.match(details.chapters[0].url, /\/chapter\/2365$/);
});

test("parseRealmDetails prefers Sky metadata while keeping full HTML range", () => {
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
      <a class="tag" href="/?tag=فانتازيا">فانتازيا</a>
    </article>
    <a class="chapter-row " href="/novel/690f7c85419b78c5ab0ef3d0/chapter/1"><span>1</span></a>
  `;
  const details = parseRealmDetails(html, "690f7c85419b78c5ab0ef3d0", "https://realmnovel.com", [
    { chapterNumber: 51, title: "الفصل 51", createdAt: "2026-07-15T00:00:00.000Z" },
    { chapterNumber: 52, title: "الفصل 52", createdAt: "2026-07-16T00:00:00.000Z" },
  ]);
  assert.equal(details.chapters.length, 100);
  assert.equal(details.chapters[50].name, "الفصل 51");
  assert.equal(details.chapters[51].locked, false);
  assert.equal(details.chapters[50].locked, false);
  assert.deepEqual(details.tags, ["اكشن", "فانتازيا"]);
  assert.ok(details.statusBadges.includes("مستمرة"));
});

test("parseRealmChapter extracts paragraphs", () => {
  const chapter = parseRealmChapter(
    `<h1 class="h1">الفصل 1</h1><div class="chapter-content"><p>أول.</p><p>ثاني.</p></div>`,
    "https://realmnovel.com/novel/690f7c85419b78c5ab0ef3d0/chapter/1",
  );
  assert.deepEqual(chapter.paragraphs, ["أول.", "ثاني."]);
});

test("parseRealmChapter ignores end-of-chapter locked footer when content exists", () => {
  const html = `<h1 class="h1">الفصل 1</h1><div class="chapter-content"><p>محتوى الفصل.</p></div><div class="locked"><h3>نهاية الفصل 1</h3></div>`;
  const chapter = parseRealmChapter(
    html,
    "https://realmnovel.com/novel/690f7c85419b78c5ab0ef3d0/chapter/1",
  );
  assert.deepEqual(chapter.paragraphs, ["محتوى الفصل."]);
  assert.equal(isRealmChapterWebLocked(html), false);
});

test("applyRealmChapterAccess keeps every chapter open including 51+", () => {
  const chapters = applyRealmChapterAccess([
    { number: "50", url: "https://realmnovel.com/novel/x/chapter/50" },
    { number: "51", url: "https://realmnovel.com/novel/x/chapter/51", lockReason: "sky-app" },
  ]);
  assert.equal(chapters[0].locked, false);
  assert.equal(chapters[1].locked, false);
  assert.equal(chapters[1].lockReason, undefined);
});

test("parseRealmChapter rejects locked page", () => {
  assert.throws(
    () => parseRealmChapter('<div class="locked"><h1>الفصل 51 غير متاح على الموقع</h1></div>', "https://realmnovel.com/novel/x/chapter/51"),
    /Sky Novel/,
  );
});

test("handleRealmNovelRequest search uses JSON API with genre filter", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    calls.push(target);
    if (target.includes("/_more")) {
      return {
        ok: true,
        async json() {
          return {
            docs: [{
              id: "690f7c85419b78c5ab0ef3d0",
              title: "رواية",
              chapters: 12,
              category: "مترجمة",
              tags: ["اكشن"],
            }],
            hasMore: false,
          };
        },
      };
    }
    return { ok: false, status: 404, async json() { return {}; } };
  };
  try {
    const { handleRealmNovelRequest } = await import("../sources/realmnovel.js");
    const response = await handleRealmNovelRequest(
      new URL("http://localhost/api/sources/realmnovel/search?q=solo&genre=اكشن"),
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.items.length, 1);
    assert.ok(calls.some((entry) => entry.includes("q=solo")));
    assert.ok(calls.some((entry) => entry.includes("tag=") || entry.includes("tag%3D")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
