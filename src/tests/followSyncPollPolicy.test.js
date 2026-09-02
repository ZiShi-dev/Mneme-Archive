import test from "node:test";
import assert from "node:assert/strict";
import { shouldRunFollowIntervalPoll } from "../lib/updates/followSyncPollPolicy.js";

test("interval poll policy keeps running in Electron when hidden", () => {
  assert.equal(shouldRunFollowIntervalPoll({
    desktopBackground: true,
    appActive: false,
    documentHidden: true,
  }), true);
});

test("interval poll policy keeps running on native when app is backgrounded", () => {
  assert.equal(shouldRunFollowIntervalPoll({
    isNative: true,
    appActive: false,
    documentHidden: true,
  }), true);
});

test("interval poll policy pauses on web when tab is hidden", () => {
  assert.equal(shouldRunFollowIntervalPoll({
    desktopBackground: false,
    appActive: true,
    documentHidden: true,
  }), false);
});

test("interval poll policy runs on web when tab is visible", () => {
  assert.equal(shouldRunFollowIntervalPoll({
    desktopBackground: false,
    appActive: true,
    documentHidden: false,
  }), true);
});
