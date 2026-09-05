import test from "node:test";
import assert from "node:assert/strict";
import {
  isOfflineMangaChapter,
  isOfflineNovelChapter,
} from "../lib/downloads/chapterPayloadKinds.js";

test("isOfflineMangaChapter accepts MangaLik-style chapters without kind", () => {
  const chapter = {
    title: "Chapter 1",
    url: "https://mangalik.net/manga/x/1/",
    pages: [{ src: "https://cdn.example/page-1.jpg" }],
  };
  assert.equal(isOfflineMangaChapter(chapter), true);
});

test("isOfflineMangaChapter rejects novel payloads", () => {
  const chapter = {
    kind: "novel",
    paragraphs: ["line"],
    pages: [{ src: "https://cdn.example/page-1.jpg" }],
  };
  assert.equal(isOfflineMangaChapter(chapter), false);
  assert.equal(isOfflineNovelChapter(chapter), true);
});

test("isOfflineMangaChapter keeps explicit manga kind", () => {
  const chapter = {
    kind: "manga",
    pages: [{ src: "https://cdn.example/page-1.jpg" }],
  };
  assert.equal(isOfflineMangaChapter(chapter), true);
});
