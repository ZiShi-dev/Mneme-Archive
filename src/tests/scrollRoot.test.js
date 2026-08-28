import test from "node:test";
import assert from "node:assert/strict";
import { getAppScrollElement } from "../lib/platform/scrollRoot.js";

test("getAppScrollElement returns document scrolling element when no desktop frame", () => {
  if (typeof document === "undefined") {
    assert.equal(getAppScrollElement(), null);
    return;
  }
  const el = getAppScrollElement();
  assert.ok(el);
});
