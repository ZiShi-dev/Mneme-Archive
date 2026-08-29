import test from "node:test";
import assert from "node:assert/strict";

test("getDesktopNotificationChipKey prefers tray wording on Electron", async () => {
  const previous = global.window;
  global.window = {
    cinevaultDesktop: { isElectron: true },
  };

  const { getDesktopNotificationChipKey, isElectronApp, focusElectronApp } = await import("../lib/platform/electronApp.js");
  assert.equal(isElectronApp(), true);
  assert.equal(getDesktopNotificationChipKey(), "notify.desktopTrayChip");

  let focused = false;
  global.window.cinevaultDesktop.focusApp = () => { focused = true; };
  focusElectronApp();
  assert.equal(focused, true);

  delete global.window.cinevaultDesktop;
  assert.equal(getDesktopNotificationChipKey(), "notify.desktopTabChip");

  global.window = previous;
});
