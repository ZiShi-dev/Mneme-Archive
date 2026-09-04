import test from "node:test";
import assert from "node:assert/strict";
import { compactCatalogItem, compactSnapshotItems } from "../features/sources/catalogSnapshotModel.js";

test("compactCatalogItem keeps only catalog card fields", () => {
  const compact = compactCatalogItem({
    url: "https://galaxynovels.com/novel/demo",
    title: "Demo Novel",
    cover: "https://cdn.example.com/cover.jpg",
    sourceId: "galaxynovels",
    novelId: 42,
    latestChapter: "الفصل 12",
    latestChapterUrl: "https://galaxynovels.com/novel/demo/12",
    recentChapters: [
      { number: "12", name: "الفصل 12", url: "https://galaxynovels.com/novel/demo/12" },
      { number: "11", name: "الفصل 11", url: "https://galaxynovels.com/novel/demo/11" },
      { number: "10", name: "الفصل 10", url: "https://galaxynovels.com/novel/demo/10" },
    ],
    htmlBlob: "<huge>",
    chapters: Array.from({ length: 200 }, (_, index) => ({ url: String(index) })),
  });

  assert.equal(compact.url, "https://galaxynovels.com/novel/demo");
  assert.equal(compact.novelId, 42);
  assert.equal(compact.recentChapters.length, 2);
  assert.equal(compact.htmlBlob, undefined);
  assert.equal(compact.chapters, undefined);
});

test("compactSnapshotItems drops invalid rows", () => {
  assert.deepEqual(
    compactSnapshotItems([{ title: "missing url" }, { url: "https://example.com/n", title: "Ok" }]).map((item) => item.title),
    ["Ok"],
  );
});
