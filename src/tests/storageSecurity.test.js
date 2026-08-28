import test from "node:test";
import assert from "node:assert/strict";
import { STORAGE_META_CHAPTER_LOG_BACKFILL } from "../lib/storage/constants.js";
import {
  isAllowedImageUrl,
  isAllowedStorageKey,
  isBlockedNetworkHost,
} from "../lib/storage/security.js";

test("isAllowedStorageKey accepts chapter log backfill meta key", () => {
  assert.equal(isAllowedStorageKey(STORAGE_META_CHAPTER_LOG_BACKFILL), true);
});

test("isAllowedStorageKey accepts chromebook nav collapsed key", () => {
  assert.equal(isAllowedStorageKey("cromebook:nav-collapsed"), true);
});

test("isAllowedStorageKey accepts locale and reader preference keys", () => {
  assert.equal(isAllowedStorageKey("cromebook:locale"), true);
  assert.equal(isAllowedStorageKey("living-archive:reader-preferences"), true);
  assert.equal(isAllowedStorageKey("cinevault:pwa-install-dismissed"), true);
});

test("isAllowedStorageKey rejects unknown and oversized keys", () => {
  assert.equal(isAllowedStorageKey("evil:payload"), false);
  assert.equal(isAllowedStorageKey(""), false);
  assert.equal(isAllowedStorageKey(`living-archive:chapter-progress:${"x".repeat(2100)}`), false);
});

test("isAllowedImageUrl rejects private network hosts", () => {
  assert.equal(isAllowedImageUrl("https://127.0.0.1/poster.jpg"), false);
  assert.equal(isAllowedImageUrl("https://cdn.example.com/poster.jpg"), true);
  assert.equal(isAllowedImageUrl("http://cdn.example.com/poster.jpg"), false);
});

test("isBlockedNetworkHost mirrors server-side private host rules", () => {
  assert.equal(isBlockedNetworkHost("localhost"), true);
  assert.equal(isBlockedNetworkHost("images.example.com"), false);
});

test("peekStorageString rejects disallowed keys", async () => {
  const { peekStorageString } = await import("../lib/storage/peek.js");
  assert.throws(() => peekStorageString("evil:payload"), /non autorisée/);
  assert.equal(peekStorageString("cromebook:locale", "fr"), "fr");
});
