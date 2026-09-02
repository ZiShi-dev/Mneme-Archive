import test from "node:test";
import assert from "node:assert/strict";
import {
  getAppScrollElement,
  getMaxScrollTop,
  getScrollTop,
  scrollReaderTo,
} from "../lib/platform/scrollRoot.js";

test("getAppScrollElement returns document scrolling element when no desktop frame", () => {
  if (typeof document === "undefined") {
    assert.equal(getAppScrollElement(), null);
    return;
  }
  const el = getAppScrollElement();
  assert.ok(el);
});

test("getAppScrollElement prefers live reader body scroll container", () => {
  if (typeof document === "undefined") return;

  const root = document.createElement("div");
  root.id = "root";
  const reader = document.createElement("div");
  reader.className = "live-reader";
  const body = document.createElement("div");
  body.className = "live-reader__body";
  Object.defineProperty(body, "clientHeight", { value: 400, configurable: true });
  Object.defineProperty(body, "scrollHeight", { value: 1200, configurable: true });
  body.scrollTop = 400;
  reader.append(body);
  root.append(reader);
  document.body.append(root);

  try {
    assert.equal(getAppScrollElement(), body);
    assert.equal(getScrollTop(body), 400);
    assert.equal(getMaxScrollTop(body), 800);
    scrollReaderTo(600, { root: body });
    assert.equal(getScrollTop(body), 600);
  } finally {
    root.remove();
  }
});
