import test from "node:test";
import assert from "node:assert/strict";
import { allowsHeavyNetworkUse, getMeteredNetworkLimits } from "../lib/platform/dataSaver.js";

test("allowsHeavyNetworkUse always allows traffic when wifi-only is disabled", () => {
  assert.equal(allowsHeavyNetworkUse({ wifi: false }), true);
});

test("getMeteredNetworkLimits reduces home fetch quotas on metered networks", () => {
  const limits = getMeteredNetworkLimits({ wifi: true });
  if (limits.metered) {
    assert.equal(limits.homeLatestLimit, 6);
    assert.equal(limits.homeLatestConcurrency, 1);
  } else {
    assert.equal(limits.homeLatestLimit, 12);
    assert.equal(limits.homeLatestConcurrency, 4);
  }
});
