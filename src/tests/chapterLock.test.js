import test from "node:test";
import assert from "node:assert/strict";
import {
  formatUnlockCountdown,
  formatUnlockCountdownLabel,
  isAzoraChapterBlocked,
  isAzoraFlySource,
  isCatalogChapterBlocked,
  isChapterLocked,
  isChapterTimedLock,
  isRealmNovelSource,
  parseUnlockAt,
} from "../lib/media/chapterLock.js";

test("isRealmNovelSource matches realmnovel only", () => {
  assert.equal(isRealmNovelSource("realmnovel"), true);
  assert.equal(isRealmNovelSource("RealmNovel"), true);
  assert.equal(isRealmNovelSource("azorafly"), false);
});

test("isCatalogChapterBlocked never blocks realmnovel chapters", () => {
  assert.equal(isCatalogChapterBlocked("realmnovel", { locked: true }), false);
  assert.equal(isCatalogChapterBlocked("realmnovel", { locked: true, lockReason: "sky-app" }), false);
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(isCatalogChapterBlocked("azorafly", { locked: true, unlockAt: future }), true);
});

test("isAzoraFlySource matches azorafly only", () => {
  assert.equal(isAzoraFlySource("azorafly"), true);
  assert.equal(isAzoraFlySource("AzoraFly"), true);
  assert.equal(isAzoraFlySource("mangapark"), false);
  assert.equal(isAzoraFlySource(""), false);
});

test("parseUnlockAt reads ISO dates and ignores invalid values", () => {
  assert.equal(parseUnlockAt({ unlockAt: "2026-09-01T12:00:00.000Z" }), Date.parse("2026-09-01T12:00:00.000Z"));
  assert.equal(parseUnlockAt("2026-09-01T12:00:00.000Z"), Date.parse("2026-09-01T12:00:00.000Z"));
  assert.equal(parseUnlockAt({ unlockAt: null }), null);
  assert.equal(parseUnlockAt({ unlockAt: "not-a-date" }), null);
  assert.equal(parseUnlockAt({}), null);
});

test("isAzoraChapterBlocked gates locked azorafly chapters", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const past = new Date(Date.now() - 60_000).toISOString();
  assert.equal(isAzoraChapterBlocked("azorafly", { locked: true }), true);
  assert.equal(isAzoraChapterBlocked("azorafly", { locked: true, unlockAt: null }), true);
  assert.equal(isAzoraChapterBlocked("azorafly", { locked: true, unlockAt: future }), true);
  assert.equal(isAzoraChapterBlocked("azorafly", { locked: true, unlockAt: past }), false);
  assert.equal(isAzoraChapterBlocked("azorafly", { locked: false, unlockAt: future }), false);
  assert.equal(isAzoraChapterBlocked("kolnovel", { locked: true }), false);
});

test("isChapterTimedLock requires a future unlockAt", () => {
  const future = new Date(Date.now() + 120_000).toISOString();
  const past = new Date(Date.now() - 120_000).toISOString();
  assert.equal(isChapterTimedLock({ locked: true, unlockAt: future }), true);
  assert.equal(isChapterTimedLock({ locked: true, unlockAt: past }), false);
  assert.equal(isChapterLocked({ locked: true }), true);
});

test("formatUnlockCountdown splits remaining time", () => {
  const parts = formatUnlockCountdown((((2 * 24 + 4) * 3600) + (12 * 60) + 9) * 1000);
  assert.deepEqual(parts, { days: 2, hours: 4, minutes: 12, seconds: 9 });
  assert.equal(formatUnlockCountdownLabel((((2 * 24 + 4) * 3600) + (12 * 60) + 9) * 1000), "2d 04:12:09");
  assert.equal(formatUnlockCountdownLabel((4 * 3600 + 12 * 60 + 9) * 1000), "04:12:09");
});
