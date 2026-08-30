import test from "node:test";
import assert from "node:assert/strict";
import {
  extractHentaigasmCover,
  extractHentaigasmVideoUrl,
  normalizeHentaigasmAssetUrl,
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

test("extractHentaigasmVideoUrl encodes spaces in CDN paths", () => {
  const html = `jwplayer("p").setup({ file: "https://hgasm1.com/My Episode 1.mp4" });`;
  assert.equal(
    extractHentaigasmVideoUrl(html),
    "https://hgasm1.com/My%20Episode%201.mp4",
  );
});

test("extractHentaigasmVideoUrl rejects foreign hosts", () => {
  const html = `jwplayer("p").setup({ file: "https://evil.example/videos/sample.mp4" });`;
  assert.equal(extractHentaigasmVideoUrl(html), "");
});

test("extractHentaigasmCover prefers player image", () => {
  assert.equal(
    extractHentaigasmCover(POST_CONTENT, "Sample Episode"),
    "https://hgasm1.com/preview/sample.jpg",
  );
});

test("extractHentaigasmCover rejects foreign hosts", () => {
  const html = `jwplayer("p").setup({ image: "https://evil.example/preview/x.jpg" });`;
  assert.equal(extractHentaigasmCover(html, "Sample Episode"), "https://hgasm1.com/preview/Sample%20Episode.jpg");
});

test("normalizeHentaigasmAssetUrl enforces image path allowlist", () => {
  assert.equal(
    normalizeHentaigasmAssetUrl("https://hgasm1.com/preview/ok.jpg"),
    "https://hgasm1.com/preview/ok.jpg",
  );
  assert.equal(normalizeHentaigasmAssetUrl("https://hgasm1.com/secret/payload.bin"), "");
  assert.equal(
    normalizeHentaigasmAssetUrl("https://hgasm2.com/videos/sample.mp4", { requireMp4: true }),
    "https://hgasm2.com/videos/sample.mp4",
  );
});

test("parseHentaigasmCatalogFromPosts maps REST posts", () => {
  const items = parseHentaigasmCatalogFromPosts([WP_POST]);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Sample Episode");
  assert.equal(items[0].sourceId, "hentaigasm");
  assert.equal(items[0].mediaType, "anime");
  assert.equal(items[0].cover, "https://hgasm1.com/preview/sample.jpg");
});

test("parseHentaigasmChapterFromHtml returns video chapter with sources", () => {
  const chapter = parseHentaigasmChapterFromHtml(
    `<h1 id="title">Sample Episode</h1>${POST_CONTENT}`,
    "https://hentaigasm.com/sample-episode/",
  );
  assert.equal(chapter.kind, "video");
  assert.equal(chapter.playbackMode, "video");
  assert.equal(chapter.videoUrl, "https://hgasm2.com/videos/sample.mp4");
  assert.equal(chapter.streamReferer, "https://hentaigasm.com/");
  assert.equal(chapter.streamType, "mp4");
  assert.equal(chapter.sources.length, 1);
  assert.equal(chapter.sources[0].streamUrl, "https://hgasm2.com/videos/sample.mp4");
  assert.equal(chapter.sources[0].streamType, "mp4");
  assert.equal(chapter.sources[0].streamReferer, "https://hentaigasm.com/");
});
