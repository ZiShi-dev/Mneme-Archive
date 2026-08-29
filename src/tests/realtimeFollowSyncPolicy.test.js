import test from "node:test";
import assert from "node:assert/strict";

function shouldRunIntervalPoll({ desktopBackground, appActive, documentHidden }) {
  if (!desktopBackground && !appActive) return false;
  if (!desktopBackground && documentHidden) return false;
  return true;
}

test("interval poll policy keeps running in Electron when hidden", () => {
  assert.equal(shouldRunIntervalPoll({
    desktopBackground: true,
    appActive: false,
    documentHidden: true,
  }), true);
});

test("interval poll policy pauses on web when tab is hidden", () => {
  assert.equal(shouldRunIntervalPoll({
    desktopBackground: false,
    appActive: true,
    documentHidden: true,
  }), false);
});

test("interval poll policy runs on web when tab is visible", () => {
  assert.equal(shouldRunIntervalPoll({
    desktopBackground: false,
    appActive: true,
    documentHidden: false,
  }), true);
});
