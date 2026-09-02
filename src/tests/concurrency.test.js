import test from "node:test";
import assert from "node:assert/strict";
import { mapPool } from "../lib/updates/concurrency.js";

test("mapPool runs mapper with limited concurrency", async () => {
  let active = 0;
  let maxActive = 0;
  const items = [1, 2, 3, 4, 5, 6];

  const results = await mapPool(items, 2, async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value * 2;
  });

  assert.deepEqual(results, [2, 4, 6, 8, 10, 12]);
  assert.equal(maxActive, 2);
});
