import test from "node:test";
import assert from "node:assert/strict";
import { getDocumentFullscreenElement, isFullscreenWithinRoot } from "../lib/video/fullscreenTarget.js";

test("getDocumentFullscreenElement prefers standard then webkit", () => {
  assert.equal(getDocumentFullscreenElement(null), null);
  assert.equal(getDocumentFullscreenElement({}), null);
  const iframe = { id: "embed" };
  assert.equal(getDocumentFullscreenElement({ fullscreenElement: iframe }), iframe);
  assert.equal(getDocumentFullscreenElement({ webkitFullscreenElement: iframe }), iframe);
});

test("isFullscreenWithinRoot treats the root and descendant iframes as fullscreen", () => {
  const iframe = { id: "embed" };
  const root = {
    contains(node) {
      return node === iframe;
    },
  };

  assert.equal(isFullscreenWithinRoot(null, iframe), false);
  assert.equal(isFullscreenWithinRoot(root, null), false);
  assert.equal(isFullscreenWithinRoot(root, root), true);
  assert.equal(isFullscreenWithinRoot(root, iframe), true);
  assert.equal(isFullscreenWithinRoot(root, { id: "other" }), false);
});
