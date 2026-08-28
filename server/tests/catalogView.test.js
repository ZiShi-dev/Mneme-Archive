import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogItemMatchesFilter,
  catalogViewKey,
  isSearchQueryActive,
  resolveEffectiveFilter,
  shouldUseCatalogScopedSearch,
} from "../../src/features/sources/catalogView.js";

test("catalogViewKey keeps kind, filter and query distinct", () => {
  const base = catalogViewKey("frenchstream", null, "", null);
  const series = catalogViewKey("frenchstream", null, "", { slug: "series" });
  const tagged = catalogViewKey("frenchstream", { type: "tag", slug: "2024", name: "2024" }, "", { slug: "series" });
  const searched = catalogViewKey("frenchstream", null, "naruto", { slug: "series" });

  assert.notEqual(base, series);
  assert.notEqual(series, tagged);
  assert.notEqual(tagged, searched);
});

test("resolveEffectiveFilter keeps taxonomy while preserving kind metadata", () => {
  const kind = { type: "kind", slug: "series", name: "مسلسلات", filterPath: "/s-tv/" };
  const taxonomy = { type: "category", slug: "action", name: "أكشن", filterPath: "/films/action/" };
  const effective = resolveEffectiveFilter(kind, taxonomy);

  assert.equal(effective.slug, "action");
  assert.equal(effective.kindSlug, "series");
  assert.equal(effective.kindFilterPath, "/s-tv/");
});

test("catalogItemMatchesFilter filters series items", () => {
  const kind = { type: "kind", slug: "series", name: "مسلسلات" };
  assert.equal(catalogItemMatchesFilter({ mediaType: "series", title: "A" }, kind), true);
  assert.equal(catalogItemMatchesFilter({ mediaType: "movie", title: "B" }, kind), false);
  assert.equal(
    catalogItemMatchesFilter({ mediaType: "series", mediaTypeLabel: "مسلسل", title: "You" }, { slug: "series", name: "مسلسلات" }),
    true,
  );
});

test("shouldUseCatalogScopedSearch keeps kind-only search on the site search", () => {
  const series = { type: "kind", slug: "series", name: "مسلسلات", filterPath: "/serie-en-streaming/" };
  const movies = { type: "kind", slug: "movies", name: "أفلام", filterPath: "/anime-type/movie/" };
  const anime = { type: "kind", slug: "anime", name: "أنمي", filterPath: "/anime-type/tv2/" };
  const manga = { type: "kind", slug: "manga", name: "مانغا", filterPath: "/all/" };
  const novel = { type: "kind", slug: "novel", name: "روايات", filterPath: "/all/" };
  const genre = { type: "category", slug: "action", name: "أكشن" };

  assert.equal(shouldUseCatalogScopedSearch("wiflix", series, null, "you"), false);
  assert.equal(shouldUseCatalogScopedSearch("frenchstream", series, null, "reacher"), false);
  assert.equal(shouldUseCatalogScopedSearch("anime4up", movies, null, "naruto"), false);
  assert.equal(shouldUseCatalogScopedSearch("anime4up", anime, null, "naruto"), false);
  assert.equal(shouldUseCatalogScopedSearch("azorafly", novel, null, "solo"), false);
  assert.equal(shouldUseCatalogScopedSearch("cenele", manga, null, "solo"), false);
  assert.equal(shouldUseCatalogScopedSearch("anime4up", movies, genre, "naruto"), true);
  assert.equal(shouldUseCatalogScopedSearch("mangalik", null, genre, "naruto"), true);
});

test("catalogItemMatchesFilter covers video and reading kinds", () => {
  assert.equal(catalogItemMatchesFilter({ mediaType: "anime" }, { type: "kind", slug: "anime" }), true);
  assert.equal(catalogItemMatchesFilter({ mediaType: "movie" }, { type: "kind", slug: "anime" }), false);
  assert.equal(catalogItemMatchesFilter({ mediaType: "movie" }, { type: "kind", slug: "movies" }), true);
  assert.equal(catalogItemMatchesFilter({ mediaType: "manga" }, { type: "kind", slug: "manga" }), true);
  assert.equal(catalogItemMatchesFilter({ mediaType: "novel" }, { type: "kind", slug: "manga" }), false);
  assert.equal(catalogItemMatchesFilter({ mediaType: "novel" }, { type: "kind", slug: "novel" }), true);
  assert.equal(
    catalogItemMatchesFilter({ mediaType: "manga" }, { type: "kind", slug: "novel", name: "روايات", filterPath: "/all/" }),
    false,
  );
  assert.equal(
    catalogItemMatchesFilter({ mediaType: "novel" }, { type: "kind", slug: "novel", name: "روايات", filterPath: "/all/" }),
    true,
  );
});

test("isSearchQueryActive requires at least two characters", () => {
  assert.equal(isSearchQueryActive("a"), false);
  assert.equal(isSearchQueryActive("ab"), true);
});
