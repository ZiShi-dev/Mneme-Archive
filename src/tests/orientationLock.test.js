import test from "node:test";
import assert from "node:assert/strict";
import { lockLandscapeOrientation, unlockOrientation } from "../lib/video/orientationLock.js";

test("unlockOrientation does not throw when screen.orientation is missing", () => {
  const original = globalThis.screen;
  globalThis.screen = {};
  assert.doesNotThrow(() => unlockOrientation());
  globalThis.screen = original;
});

test("lockLandscapeOrientation returns false without orientation.lock", async () => {
  const original = globalThis.screen;
  globalThis.screen = { orientation: {} };
  assert.equal(await lockLandscapeOrientation(), false);
  globalThis.screen = original;
});

test("lockLandscapeOrientation uses the first successful lock mode", async () => {
  const original = globalThis.screen;
  const calls = [];
  globalThis.screen = {
    orientation: {
      lock: async (type) => {
        calls.push(type);
        if (type === "landscape") throw new Error("unsupported");
      },
    },
  };
  assert.equal(await lockLandscapeOrientation(), true);
  assert.deepEqual(calls, ["landscape", "landscape-primary"]);
  globalThis.screen = original;
});
