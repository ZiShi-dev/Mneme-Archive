import test from "node:test";
import assert from "node:assert/strict";
import {
  allowsFollowSyncNetworkUse,
  allowsHeavyNetworkUse,
  allowsSpeculativePrefetch,
  getMeteredNetworkLimits,
  getReaderImageBudget,
  readerImageBudgetForFlag,
} from "../lib/platform/dataSaver.js";

test("allowsHeavyNetworkUse always allows traffic when wifi-only is disabled", () => {
  assert.equal(allowsHeavyNetworkUse({ wifi: false }), true);
  assert.equal(allowsFollowSyncNetworkUse({ wifi: false }), true);
  assert.equal(allowsSpeculativePrefetch({ wifi: false }), true);
});

test("getMeteredNetworkLimits reduces home fetch quotas on metered networks", () => {
  const limits = getMeteredNetworkLimits({ wifi: true });
  if (limits.metered) {
    assert.equal(limits.homeLatestLimit, 6);
    assert.equal(limits.homeLatestConcurrency, 1);
    assert.equal(limits.imageFetchConcurrency, 2);
    assert.equal(limits.htmlFetchConcurrency, 2);
  } else {
    assert.equal(limits.homeLatestLimit, 12);
    assert.equal(limits.homeLatestConcurrency, 4);
    assert.equal(limits.imageFetchConcurrency, 6);
    assert.equal(limits.htmlFetchConcurrency, 4);
  }
});

test("getReaderImageBudget stays generous when wifi-only is off", () => {
  const budget = getReaderImageBudget({ wifi: false });
  assert.equal(budget.initialWindow, 8);
  assert.equal(budget.unlockBatch, 4);
  assert.equal(budget.eagerPreloadPages, 8);
  assert.equal(budget.catalogLazyCoverFrom, 6);
});

test("readerImageBudgetForFlag shrinks chapter and cover loading on mobile data", () => {
  const budget = readerImageBudgetForFlag(true);
  assert.equal(budget.initialWindow, 2);
  assert.equal(budget.unlockBatch, 1);
  assert.equal(budget.eagerPreloadPages, 0);
  assert.equal(budget.catalogPriorityCount, 1);
  assert.equal(budget.catalogLazyCoverFrom, 2);
});

test("getReaderImageBudget follows the current network policy", () => {
  const settings = { wifi: true };
  const budget = getReaderImageBudget(settings);
  assert.deepEqual(budget, readerImageBudgetForFlag(getMeteredNetworkLimits(settings).metered));
});
