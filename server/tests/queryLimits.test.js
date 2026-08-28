import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSearchQuery, MAX_SEARCH_QUERY_LENGTH } from "../lib/queryLimits.js";

test("normalizeSearchQuery rejects short queries", () => {
  assert.deepEqual(normalizeSearchQuery("a"), { query: "", valid: false });
  assert.deepEqual(normalizeSearchQuery("  "), { query: "", valid: false });
});

test("normalizeSearchQuery accepts valid queries", () => {
  assert.deepEqual(normalizeSearchQuery("naruto"), { query: "naruto", valid: true });
});

test("normalizeSearchQuery truncates long queries", () => {
  const longQuery = "x".repeat(MAX_SEARCH_QUERY_LENGTH + 50);
  const result = normalizeSearchQuery(longQuery);
  assert.equal(result.query.length, MAX_SEARCH_QUERY_LENGTH);
  assert.equal(result.valid, true);
});
