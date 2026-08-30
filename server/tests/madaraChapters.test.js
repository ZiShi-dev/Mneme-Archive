import test from "node:test";
import assert from "node:assert/strict";
import {
  extractMadaraMangaId,
  parseMadaraChapters,
  resolveMadaraChapters,
} from "../lib/madaraChapters.js";

const CHAPTER_LIST = `
<li class="wp-manga-chapter">
  <a href="https://example.com/manga/sample/chapter-10/">Chapter 10</a>
</li>
<li class="wp-manga-chapter">
  <a href="https://example.com/manga/sample/chapter-9/">Chapter 9</a>
</li>`;

test("extractMadaraMangaId reads ajax holder id", () => {
  const html = `<div id="manga-chapters-holder" data-id="361905"></div>`;
  assert.equal(extractMadaraMangaId(html), "361905");
});

test("parseMadaraChapters reads all wp-manga-chapter rows", () => {
  const chapters = parseMadaraChapters(CHAPTER_LIST);
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "10");
});

test("resolveMadaraChapters uses FlareSolverr html fetcher for ajax chapters", async () => {
  const html = `
    <div id="manga-chapters-holder" data-id="99"></div>
    <li class="wp-manga-chapter"><a href="https://example.com/manga/sample/chapter-1/">Chapter 1</a></li>
  `;
  const chapters = await resolveMadaraChapters(html, {
    baseUrl: "https://example.com",
    refererUrl: "https://example.com/manga/sample/",
    fetchHtml: async (url) => {
      assert.equal(url, "https://example.com/manga/sample/ajax/chapters/");
      return CHAPTER_LIST;
    },
  });
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].number, "10");
});

test("resolveMadaraChapters prefers longer ajax list", async () => {
  const html = `
    <div id="manga-chapters-holder" data-id="99"></div>
    <li class="wp-manga-chapter"><a href="https://example.com/manga/sample/chapter-1/">Chapter 1</a></li>
  `;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async text() { return CHAPTER_LIST; },
  });
  try {
    const chapters = await resolveMadaraChapters(html, {
      baseUrl: "https://example.com",
      refererUrl: "https://example.com/manga/sample/",
    });
    assert.equal(chapters.length, 2);
    assert.equal(chapters[0].number, "10");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
