import assert from "node:assert/strict";
import test from "node:test";
import { estimateNovelDownloadBatch } from "../lib/downloads/estimateNovelDownloadSize.js";
import { formatDataUsage } from "../lib/downloads/formatBytes.js";
import { normalizeDownloadItem } from "../lib/downloads/downloadsModel.js";

test("estimateNovelDownloadBatch skips already saved chapters", () => {
  const store = {
    version: 1,
    items: [
      normalizeDownloadItem({
        id: "realmnovel::https://example.com/novel",
        sourceId: "realmnovel",
        title: "Novel",
        seriesUrl: "https://example.com/novel",
        mediaType: "novel",
        chapters: [
          { url: "/c1", status: "complete", progress: 100, sizeBytes: 1200 },
        ],
      }),
    ].filter(Boolean),
  };
  const estimate = estimateNovelDownloadBatch(
    "realmnovel",
    [{ url: "/c1", number: "1" }, { url: "/c2", number: "2" }],
    { url: "https://example.com/novel" },
    store,
  );
  assert.equal(estimate.alreadySavedCount, 1);
  assert.equal(estimate.pendingCount, 1);
  assert.equal(estimate.dataBytes, 1200);
});

test("formatDataUsage prefers gigabytes for larger downloads", () => {
  assert.match(formatDataUsage(2 * 1024 ** 3, "fr"), /Go/);
  assert.match(formatDataUsage(5 * 1024 ** 2, "fr"), /Mo/);
  assert.match(formatDataUsage(12 * 1024, "fr"), /KB/);
});
