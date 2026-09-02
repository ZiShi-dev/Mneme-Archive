import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSkyChapterPayload,
  fetchSkyJson,
  fetchSkyChapter,
  clearSkyApiCache,
  isSkyUnauthorized,
  SKY_APP_ONLY_CHAPTER_MESSAGE,
} from "../lib/skynovelApi.js";

test("parseSkyChapterPayload extracts paragraphs from API data", () => {
  const result = parseSkyChapterPayload({
    success: true,
    data: {
      title: "الفصل 51",
      content: "سطر أول.\n\nسطر ثاني.",
    },
  }, "http://example/chapter/51");
  assert.equal(result.title, "الفصل 51");
  assert.equal(result.paragraphs.length, 2);
  assert.equal(result.kind, "novel");
});

test("parseSkyChapterPayload reads nested chapter content", () => {
  const result = parseSkyChapterPayload({
    success: true,
    data: {
      chapter: {
        title: "الفصل 1",
        content: "فقرة واحدة",
      },
    },
  }, "http://example/chapter/1");
  assert.equal(result.title, "الفصل 1");
  assert.deepEqual(result.paragraphs, ["فقرة واحدة"]);
});

test("fetchSkyJson maps unauthorized chapter access to an Arabic load error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    async json() {
      return { success: false, message: "غير مصرح" };
    },
  });
  try {
    assert.equal(isSkyUnauthorized({ message: "غير مصرح" }, 403), true);
    await assert.rejects(
      () => fetchSkyJson("/novels/abc/chapters/51"),
      (error) => error.message === SKY_APP_ONLY_CHAPTER_MESSAGE,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchSkyJson rejects absolute URLs", async () => {
  await assert.rejects(() => fetchSkyJson("https://evil.example/x"), /غير صالح/);
});

test("fetchSkyJson caches successful GET responses", async () => {
  clearSkyApiCache();
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return { success: true, data: { ok: true } };
      },
    };
  };
  try {
    await fetchSkyJson("/novels/latest?page=1", { cacheTtl: 60_000 });
    await fetchSkyJson("/novels/latest?page=1", { cacheTtl: 60_000 });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    clearSkyApiCache();
  }
});

test("fetchSkyChapter caches parsed chapter payloads", async () => {
  clearSkyApiCache();
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return { success: true, data: { title: "الفصل 2", content: "نص." } };
      },
    };
  };
  try {
    const url = "http://example/chapter/2";
    const first = await fetchSkyChapter("novel-id", 2, url);
    const second = await fetchSkyChapter("novel-id", 2, url);
    assert.equal(first.title, "الفصل 2");
    assert.deepEqual(second.paragraphs, first.paragraphs);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    clearSkyApiCache();
  }
});
