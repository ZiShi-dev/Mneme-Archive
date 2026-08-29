import test from "node:test";
import assert from "node:assert/strict";
import { isDesktopAppLayout } from "../lib/platform/desktopAppLayout.js";

test("isDesktopAppLayout is false in archive flavor when document is unavailable", () => {
  assert.equal(isDesktopAppLayout(), false);
});
