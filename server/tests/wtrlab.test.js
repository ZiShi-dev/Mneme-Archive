import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWtrlabCatalogUrl,
  buildWtrlabChapterUrl,
  buildWtrlabNovelUrl,
  decryptWtrlabChapterBody,
  extractNextData,
  isPredominantlyCjk,
  parseWtrlabCatalogPayload,
  parseWtrlabChapterParagraphs,
  parseWtrlabTarget,
} from "../sources/wtrlab.js";

const SAMPLE_NEXT = {
  props: {
    pageProps: {
      series: [{ raw_id: 94652, slug: "sample-novel", data: { title: "Sample", image: "https://img.wtr-lab.com/cover.png" }, chapter_count: 12 }],
      count: 42,
    },
  },
  query: { page: "2" },
};

test("buildWtrlabCatalogUrl maps genre, tag and kind presets", () => {
  assert.equal(
    buildWtrlabCatalogUrl({ page: 1 }),
    "https://wtr-lab.com/en/novel-list?page=1",
  );
  assert.equal(
    buildWtrlabCatalogUrl({ page: 2, genre: "5", tag: "696" }),
    "https://wtr-lab.com/en/novel-finder?page=2&gi=5&ti=696",
  );
  assert.equal(
    buildWtrlabCatalogUrl({ page: 1, kind: "trending" }),
    "https://wtr-lab.com/en/trending?page=1",
  );
  assert.equal(
    buildWtrlabCatalogUrl({ page: 1, kind: "popular" }),
    "https://wtr-lab.com/en/novel-finder?page=1&orderBy=view&order=desc",
  );
});

test("parseWtrlabTarget accepts novel and legacy urls", () => {
  assert.deepEqual(
    parseWtrlabTarget("https://wtr-lab.com/en/novel/94652/in-another-world-my-monster-farm/3"),
    { rawId: "94652", slug: "in-another-world-my-monster-farm", chapterNo: 3 },
  );
  assert.deepEqual(
    parseWtrlabTarget("https://wtr-lab.com/en/serie-94652/in-another-world-my-monster-farm"),
    { rawId: "94652", slug: "in-another-world-my-monster-farm", chapterNo: null },
  );
});

test("extractNextData and parseWtrlabCatalogPayload read SSR catalog", () => {
  const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(SAMPLE_NEXT)}</script></html>`;
  const nextData = extractNextData(html);
  const items = parseWtrlabCatalogPayload(nextData);
  assert.equal(items.length, 1);
  assert.equal(items[0].slug, "sample-novel");
});

test("decryptWtrlabChapterBody handles plain arrays", () => {
  assert.deepEqual(decryptWtrlabChapterBody(["Line one", "Line two"]), ["Line one", "Line two"]);
});

test("parseWtrlabChapterParagraphs filters glossary markers", () => {
  const paragraphs = parseWtrlabChapterParagraphs(["Hello ※0⛬ world"], [["Lake"]]);
  assert.deepEqual(paragraphs, ["Hello Lake world"]);
});

test("buildWtrlabNovelUrl and chapter url", () => {
  assert.equal(
    buildWtrlabNovelUrl(94652, "sample-novel"),
    "https://wtr-lab.com/en/novel/94652/sample-novel",
  );
  assert.equal(
    buildWtrlabChapterUrl(94652, "sample-novel", 4),
    "https://wtr-lab.com/en/novel/94652/sample-novel/4",
  );
});

test("isPredominantlyCjk detects Chinese text", () => {
  assert.equal(isPredominantlyCjk("至于其他像是桃酥什幺的"), true);
  assert.equal(isPredominantlyCjk("Risking five work points was hard."), false);
});
