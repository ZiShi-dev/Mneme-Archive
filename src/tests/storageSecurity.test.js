import test from "node:test";
import assert from "node:assert/strict";
import { STORAGE_META_CHAPTER_LOG_BACKFILL } from "../lib/storage/constants.js";
import { isAllowedStorageKey } from "../lib/storage/security.js";

test("isAllowedStorageKey accepts chapter log backfill meta key", () => {
  assert.equal(isAllowedStorageKey(STORAGE_META_CHAPTER_LOG_BACKFILL), true);
});
