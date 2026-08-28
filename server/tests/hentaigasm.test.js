import test from "node:test";
import assert from "node:assert/strict";
import {
  extractHentaigasmCover,
  extractHentaigasmVideoUrl,
  parseHentaigasmCatalogFromPosts,
  parseHentaigasmChapterFromHtml,
} from "../sources/hentaigasm.js";

const POST_CONTENT = `
<div class="video-player">
  <script>jwplayer("player").setup({ file: "https://hgasm2.com/videos/sample.mp4", image: "https://hgasm1.com/preview/sample.jpg" });</script>
</div>`;

const WP_POST = {
  id: 42,
  link: "https://hentaigasm.com/sample-episode/",
  title: { rendered: "Sample Episode" },
  content: { rendered: POST_CONTENT },
  date: "2026-08-20T12:00:00",
};

test("extractHentaigasmVideoUrl reads JWPlayer file", () => {
  assert.equal(
    extractHentaigasmVideoUrl(POST_CONTENT),
    "https://hgasm2.com/videos/sample.mp4",
  );
});

test("extractHentaigasmCover prefers player image", () => {
  assert.equal(
    extractHentaigasmCover(POST_CONTENT, "Sample Episode"),
    "https://hgasm1.com/preview/sample.jpg",
  );
});

test("parseHentaigasmCatalogFromPosts maps REST posts", () => {
  const items = parseHentaigasmCatalogFromPosts([WP_POST]);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Sample Episode");
  assert.equal(items[0].sourceId, "hentaigasm");
  assert.equal(items[0].mediaType, "anime");
});

test("parseHentaigasmChapterFromHtml returns video chapter", () => {
  const chapter = parseHentaigasmChapterFromHtml(
    `<h1 id="title">Sample Episode</h1>${POST_CONTENT}`,
    "https://hentaigasm.com/sample-episode/",
  );
  assert.equal(chapter.kind, "video");
  assert.equal(chapter.videoUrl, "https://hgasm2.com/videos/sample.mp4");
  assert.equal(chapter.streamReferer, "https://hentaigasm.com/");
});
