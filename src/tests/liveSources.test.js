import test from "node:test";
import assert from "node:assert/strict";
import { isLiveSourcesAvailable } from "../lib/platform/liveSources.js";

test("isLiveSourcesAvailable allows CinéVault production web builds", () => {
  assert.equal(isLiveSourcesAvailable(), true);
});
