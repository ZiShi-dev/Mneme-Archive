import test from "node:test";
import assert from "node:assert/strict";

test("ParadiseChapterFetcher web stub rejects native-only call", async () => {
  const { ParadiseChapterFetcherWeb } = await import("../plugins/paradiseChapterFetcher.web.js");
  const plugin = new ParadiseChapterFetcherWeb();
  await assert.rejects(
    () => plugin.fetchChapter({ url: "https://novelsparadise.site/novel-a-1/" }),
    /only available on Android/i,
  );
});
