import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTaxonomyFilters,
  catalogItemMatchesFilter,
  catalogViewKey,
  categoryMatchesKind,
  filterCategoriesForKind,
  filterRequestParams,
  isSearchQueryActive,
  isTaxonomyCompatibleWithKind,
  normalizeTaxonomySelection,
  resolveEffectiveFilter,
  shouldUseCatalogScopedSearch,
  toggleTaxonomySelection,
  sanitizeCatalogKind,
} from "../../src/features/sources/catalogView.js";

test("catalogViewKey keeps kind, filter and query distinct", () => {
  const base = catalogViewKey("frenchstream", null, "", null);
  const series = catalogViewKey("frenchstream", null, "", { slug: "series" });
  const tagged = catalogViewKey("frenchstream", { type: "tag", slug: "2024", name: "2024" }, "", { slug: "series" });
  const combined = catalogViewKey("frenchstream", { category: { slug: "action", name: "Action" }, tag: { slug: "2024", name: "2024" } }, "", { slug: "series" });
  const searched = catalogViewKey("frenchstream", null, "naruto", { slug: "series" });

  assert.notEqual(base, series);
  assert.notEqual(series, tagged);
  assert.notEqual(tagged, combined);
  assert.notEqual(combined, searched);
});

test("resolveEffectiveFilter keeps taxonomy while preserving kind metadata", () => {
  const kind = { type: "kind", slug: "series", name: "مسلسلات", filterPath: "/s-tv/" };
  const taxonomy = { type: "category", slug: "action", name: "أكشن", filterPath: "/films/action/" };
  const effective = resolveEffectiveFilter(kind, taxonomy);

  assert.equal(effective.category.slug, "action");
  assert.equal(effective.kindSlug, "series");
  assert.equal(effective.kindFilterPath, "/s-tv/");
});

test("filterRequestParams prefers series path when a film genre conflicts with series kind", () => {
  const kind = { type: "kind", slug: "series", filterPath: "/s-tv/" };
  const taxonomy = { type: "category", slug: "action", name: "Action", filterPath: "/films/action/", mediaKind: "movies" };
  const params = filterRequestParams(resolveEffectiveFilter(kind, taxonomy));
  assert.equal(params.filterPath, "/s-tv/");
  assert.equal(params.genre, "");
});

test("filterRequestParams keeps compatible series genre paths", () => {
  const kind = { type: "kind", slug: "series", filterPath: "/s-tv/" };
  const taxonomy = {
    type: "category",
    slug: "action-serie-",
    name: "Action",
    filterPath: "/action-serie-/",
    mediaKind: "series",
  };
  const params = filterRequestParams(resolveEffectiveFilter(kind, taxonomy));
  assert.equal(params.filterPath, "/action-serie-/");
  assert.equal(params.genre, "action-serie-");
});

test("filterCategoriesForKind exposes only series genres when series is selected", () => {
  const categories = [
    { slug: "action", name: "Action", filterPath: "/films/action/", mediaKind: "movies" },
    { slug: "action-serie-", name: "Action", filterPath: "/action-serie-/", mediaKind: "series" },
  ];
  assert.equal(filterCategoriesForKind(categories, { slug: "series" }).length, 1);
  assert.equal(isTaxonomyCompatibleWithKind({ type: "category", slug: "action", filterPath: "/films/action/", mediaKind: "movies" }, { slug: "series" }), false);
  assert.equal(categoryMatchesKind({ filterPath: "/films/action/", mediaKind: "movies" }, "series"), false);
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

test("filterRequestParams forwards kolnovel taxonomy genres", () => {
  const params = filterRequestParams({
    category: { type: "category", slug: "أكشن", name: "أكشن", filterQueryValue: "action" },
  });
  assert.equal(params.genre, "action");
});

test("sanitizeCatalogKind drops unsupported manga/novel filters", () => {
  const manga = { type: "kind", slug: "manga", name: "مانغا", filterPath: "/all/" };
  assert.equal(sanitizeCatalogKind("kolnovel", manga), null);
  assert.equal(sanitizeCatalogKind("azorafly", manga)?.slug, "manga");
  assert.equal(sanitizeCatalogKind("kolnovel", { slug: "all", name: "الكل" }), null);
});

test("sanitizeCatalogKind keeps server sort presets on single-content sources", () => {
  const popular = { slug: "popular", name: "الأكثر شعبية", type: "kind", queryValue: "popular" };
  const views = { slug: "views", name: "الأكثر مشاهدة", type: "kind", queryValue: "views" };
  assert.equal(sanitizeCatalogKind("novelphoenix", popular)?.queryValue, "popular");
  assert.equal(sanitizeCatalogKind("hentairead", views)?.queryValue, "views");
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
  assert.equal(
    shouldUseCatalogScopedSearch("frenchstream", series, { type: "category", slug: "actions", name: "Action", filterPath: "/films/actions/" }, "reacher"),
    true,
  );
  assert.equal(
    shouldUseCatalogScopedSearch("wiflix", null, { type: "tag", slug: "2024", name: "2024", filterPath: "/annee/2024/" }, "matrix"),
    true,
  );
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

test("toggleTaxonomySelection keeps category and tag together", () => {
  const category = { slug: "action", name: "Action", filterPath: "/films/action/" };
  const tag = { slug: "2024", name: "2024", filterPath: "/xfsearch/date-de-sortie/2024/" };
  const withCategory = toggleTaxonomySelection(null, "category", category);
  const withBoth = toggleTaxonomySelection(withCategory, "tag", tag);
  const normalized = normalizeTaxonomySelection(withBoth);

  assert.equal(normalized.category.slug, "action");
  assert.equal(normalized.tag.slug, "2024");

  const toggledOffTag = toggleTaxonomySelection(withBoth, "tag", tag);
  assert.equal(normalizeTaxonomySelection(toggledOffTag).tag, null);
  assert.equal(normalizeTaxonomySelection(toggledOffTag).category.slug, "action");
});

test("applyTaxonomyFilters intersects category and year tag", () => {
  const items = [
    { title: "Film A", year: "2024", genres: ["Action"] },
    { title: "Film B", year: "2023", genres: ["Action"] },
    { title: "Film C", year: "2024", genres: ["Action"] },
  ];
  const filtered = applyTaxonomyFilters(items, {
    category: { type: "category", slug: "action", name: "Action" },
    tag: { type: "tag", slug: "2024", name: "2024" },
  });

  assert.deepEqual(filtered.map((item) => item.title), ["Film A", "Film C"]);
});

test("applyTaxonomyFilters keeps tag-only server results even without year metadata", () => {
  const items = [
    { title: "Film A", altTitle: "VOSTFR" },
    { title: "Film B", year: "2024" },
  ];
  const filtered = applyTaxonomyFilters(items, {
    tag: { type: "tag", slug: "2024", name: "2024", filterPath: "/annee/2024/" },
  });

  assert.deepEqual(filtered.map((item) => item.title), ["Film A", "Film B"]);
});
