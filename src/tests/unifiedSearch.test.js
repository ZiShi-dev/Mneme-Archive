import test from "node:test";
import assert from "node:assert/strict";
import {
  flattenSearchBatches,
  filterSearchResults,
  getEnabledSources,
  isUnifiedSearchQueryActive,
  MIN_UNIFIED_SEARCH_QUERY_LENGTH,
  peekCachedSearchBatches,
  resetUnifiedSearchCache,
  resolveUnifiedSearchDebounceMs,
  searchEnabledSources,
  searchItemMatchesMediaType,
  sourceSupportsMediaType,
  UNIFIED_RESULT_LIMIT,
  buildSearchScopeKey,
  normalizeUnifiedSearchQuery,
} from "../lib/unifiedSearch.js";

const mockSources = [
  { id: "mangalik", enabled: true },
  { id: "azorafly", enabled: true },
  { id: "wiflix", enabled: false },
];

function makeItem(title, url = "https://example.com/item") {
  return { title, url, type: "manga" };
}

test("isUnifiedSearchQueryActive rejects queries shorter than minimum length", () => {
  assert.equal(MIN_UNIFIED_SEARCH_QUERY_LENGTH, 2);
  assert.equal(isUnifiedSearchQueryActive(""), false);
  assert.equal(isUnifiedSearchQueryActive(" "), false);
  assert.equal(isUnifiedSearchQueryActive("a"), false);
  assert.equal(isUnifiedSearchQueryActive("ab"), true);
  assert.equal(isUnifiedSearchQueryActive("  naruto  "), true);
});

test("getEnabledSources keeps sources without explicit enabled flag", () => {
  const sources = [
    { id: "mangalik", enabled: true },
    { id: "wiflix", enabled: false },
    { id: "azorafly" },
  ];
  assert.deepEqual(getEnabledSources(sources).map((entry) => entry.id), ["mangalik", "azorafly"]);
});

test("searchEnabledSources returns empty array for short query", async () => {
  const batches = await searchEnabledSources({
    sources: mockSources,
    query: "a",
    searchSourceImpl: async () => {
      throw new Error("should not be called");
    },
  });
  assert.deepEqual(batches, []);
});

test("searchEnabledSources returns empty array when no source is enabled", async () => {
  const batches = await searchEnabledSources({
    sources: [{ id: "mangalik", enabled: false }, { id: "wiflix", enabled: false }],
    query: "naruto",
    searchSourceImpl: async () => {
      throw new Error("should not be called");
    },
  });
  assert.deepEqual(batches, []);
});

test("searchEnabledSources tolerates partial source failures", async () => {
  resetUnifiedSearchCache();
  const batches = await searchEnabledSources({
    sources: mockSources,
    sourcePreferences: {},
    query: "naruto",
    searchSourceImpl: async (sourceId) => {
      if (sourceId === "mangalik") {
        return { items: [makeItem("Naruto", "https://mangalik.net/naruto")] };
      }
      if (sourceId === "azorafly") {
        throw new Error("network down");
      }
      return { items: [] };
    },
  });

  assert.equal(batches.length, 2);
  const ok = batches.find((batch) => batch.sourceId === "mangalik");
  const failed = batches.find((batch) => batch.sourceId === "azorafly");
  assert.equal(ok.error, null);
  assert.equal(ok.items.length, 1);
  assert.equal(failed.error, "network down");
  assert.deepEqual(failed.items, []);
});

test("flattenSearchBatches ranks and caps unified results", () => {
  const batches = [
    {
      sourceId: "mangalik",
      sourceName: "MangaLik",
      items: Array.from({ length: 20 }, (_, index) => makeItem(`Naruto ${index}`, `https://mangalik.net/naruto-${index}`)),
    },
    {
      sourceId: "azorafly",
      sourceName: "AzoraFly",
      items: [makeItem("Naruto Shippuden", "https://azorafly.com/naruto-shippuden")],
    },
  ];

  const flattened = flattenSearchBatches(batches, "naruto");
  assert.ok(flattened.length <= UNIFIED_RESULT_LIMIT);
  assert.ok(flattened.every((item) => item.key && item.sourceId));
  assert.equal(flattened[0].title.toLowerCase().includes("naruto"), true);
});

test("flattenSearchBatches preserves items when query is empty", () => {
  const batches = [
    {
      sourceId: "mangalik",
      sourceName: "MangaLik",
      items: [makeItem("One Piece", "https://mangalik.net/one-piece")],
    },
  ];
  const flattened = flattenSearchBatches(batches, "");
  assert.equal(flattened.length, 1);
  assert.equal(flattened[0].key, "mangalik:https://mangalik.net/one-piece");
});

test("sourceSupportsMediaType and searchItemMatchesMediaType filter by media type", () => {
  assert.equal(sourceSupportsMediaType("mangalik", "manga"), true);
  assert.equal(sourceSupportsMediaType("mangalik", "anime"), false);
  assert.equal(sourceSupportsMediaType("mangalik", "all"), true);

  assert.equal(searchItemMatchesMediaType({ mediaType: "manga" }, "manga"), true);
  assert.equal(searchItemMatchesMediaType({ mediaType: "anime" }, "manga"), false);
});

test("searchEnabledSources propagates AbortError", async () => {
  resetUnifiedSearchCache();
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    () => searchEnabledSources({
      sources: mockSources,
      query: "naruto",
      signal: controller.signal,
      searchSourceImpl: async () => ({ items: [makeItem("Naruto")] }),
    }),
    (error) => error.name === "AbortError",
  );
});

test("searchEnabledSources uses selected mode without remote search", async () => {
  resetUnifiedSearchCache();
  const batches = await searchEnabledSources({
    sources: [{ id: "mangalik", enabled: true }],
    sourcePreferences: {
      mangalik: {
        mode: "selected",
        selectedItems: [
          makeItem("Naruto", "https://mangalik.net/naruto"),
          makeItem("Bleach", "https://mangalik.net/bleach"),
        ],
      },
    },
    query: "naruto",
    searchSourceImpl: async () => {
      throw new Error("remote search should be skipped");
    },
  });

  assert.equal(batches.length, 1);
  assert.equal(batches[0].items.length, 1);
  assert.equal(batches[0].items[0].title, "Naruto");
});

test("searchEnabledSources streams batches through onBatch", async () => {
  resetUnifiedSearchCache();
  const events = [];

  await searchEnabledSources({
    sources: mockSources,
    sourcePreferences: {},
    query: "naruto",
    deferVariants: false,
    searchSourceImpl: async (sourceId) => {
      if (sourceId === "mangalik") {
        return { items: [makeItem("Naruto", "https://mangalik.net/naruto")] };
      }
      return { items: [] };
    },
    onBatch: (batches) => {
      events.push(batches.map((batch) => batch.sourceId).sort().join(","));
    },
  });

  assert.ok(events.length >= 2);
  assert.equal(events.at(-1).includes("azorafly"), true);
  assert.equal(events.at(-1).includes("mangalik"), true);
});

test("peekCachedSearchBatches returns cached remote results without network", async () => {
  resetUnifiedSearchCache();
  await searchEnabledSources({
    sources: mockSources,
    sourcePreferences: {},
    query: "naruto",
    deferVariants: false,
    searchSourceImpl: async () => ({ items: [makeItem("Naruto")] }),
  });

  const cached = peekCachedSearchBatches({
    sources: mockSources,
    sourcePreferences: {},
    query: "naruto",
  });

  assert.equal(cached.length, 2);
  assert.ok(cached.every((batch) => batch.items.length >= 1));
});

test("resolveUnifiedSearchDebounceMs skips wait when cache is ready", () => {
  assert.equal(resolveUnifiedSearchDebounceMs("na", { cacheReady: true }), 0);
  assert.equal(resolveUnifiedSearchDebounceMs("na", { cacheReady: false }), 200);
  assert.equal(resolveUnifiedSearchDebounceMs("nar", { cacheReady: false }), 140);
  assert.equal(resolveUnifiedSearchDebounceMs("naru", { cacheReady: false }), 160);
  assert.equal(resolveUnifiedSearchDebounceMs("naruto", { cacheReady: false }), 90);
});

test("filterSearchResults narrows visible items while typing", () => {
  const items = [
    { title: "Naruto", url: "https://a/naruto" },
    { title: "Naruto Shippuden", url: "https://a/naruto-shippuden" },
    { title: "One Piece", url: "https://a/one-piece" },
  ];
  const filtered = filterSearchResults(items, "naruto");
  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((item) => item.title.toLowerCase().includes("naruto")));
});

test("normalizeUnifiedSearchQuery trims and caps length", () => {
  assert.equal(normalizeUnifiedSearchQuery("  naruto  "), "naruto");
  assert.equal(normalizeUnifiedSearchQuery("x".repeat(250)).length, 200);
});

test("buildSearchScopeKey ignores source list identity and disabled sources", () => {
  const left = buildSearchScopeKey(
    [{ id: "mangalik", enabled: true }, { id: "wiflix", enabled: false }],
    { mangalik: { mode: "full" } },
    "all",
  );
  const right = buildSearchScopeKey(
    [{ id: "wiflix", enabled: false }, { id: "mangalik", enabled: true }],
    { mangalik: { mode: "full" } },
    "all",
  );
  assert.equal(left, right);
  assert.equal(left.includes("wiflix"), false);
});

test("searchEnabledSources reuses an in-flight request for the same source and query", async () => {
  resetUnifiedSearchCache();
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const searchSourceImpl = async () => {
    calls += 1;
    await gate;
    return { items: [makeItem("Naruto", "https://mangalik.net/naruto")] };
  };

  const first = searchEnabledSources({
    sources: [{ id: "mangalik", enabled: true }],
    query: "naruto",
    deferVariants: false,
    searchSourceImpl,
  });
  const second = searchEnabledSources({
    sources: [{ id: "mangalik", enabled: true }],
    query: "naruto",
    deferVariants: false,
    searchSourceImpl,
  });

  release();
  const [left, right] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(left[0].items[0].title, "Naruto");
  assert.equal(right[0].items[0].title, "Naruto");
});
