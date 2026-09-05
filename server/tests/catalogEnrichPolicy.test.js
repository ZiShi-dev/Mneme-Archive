import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogEnrichFromCatalogParams,
  catalogEnrichFromSearchParams,
  parseCatalogEnrichFlag,
} from "../lib/catalogEnrichPolicy.js";

test("parseCatalogEnrichFlag defaults to enrich", () => {
  assert.equal(parseCatalogEnrichFlag(null), true);
  assert.equal(parseCatalogEnrichFlag(""), true);
  assert.equal(parseCatalogEnrichFlag("1"), true);
});

test("parseCatalogEnrichFlag disables enrich for fast catalog", () => {
  assert.equal(parseCatalogEnrichFlag("0"), false);
  assert.equal(parseCatalogEnrichFlag("false"), false);
  assert.equal(parseCatalogEnrichFlag("no"), false);
});

test("catalogEnrichFromCatalogParams defaults to enrich", () => {
  assert.equal(catalogEnrichFromCatalogParams(new URLSearchParams()), true);
  assert.equal(catalogEnrichFromCatalogParams(new URLSearchParams("enrich=0")), false);
});

test("catalogEnrichFromSearchParams skips enrich by default", () => {
  assert.equal(catalogEnrichFromSearchParams(new URLSearchParams()), false);
  assert.equal(catalogEnrichFromSearchParams(new URLSearchParams("enrich=1")), true);
});

test("catalogEnrichFromSearchParams reads enrich=0", () => {
  const params = new URLSearchParams("page=1&enrich=0");
  assert.equal(catalogEnrichFromSearchParams(params), false);
});
