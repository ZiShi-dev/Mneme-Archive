import test from "node:test";
import assert from "node:assert/strict";
import { toUserFacingError } from "../lib/errors/userFacingError.js";

test("toUserFacingError keeps safe Arabic messages", () => {
  assert.equal(toUserFacingError(new Error("تعذر تحميل الفصل"), "fallback"), "تعذر تحميل الفصل");
});

test("toUserFacingError hides internal messages", () => {
  assert.equal(toUserFacingError(new Error("TypeError: Cannot read properties"), "تعذر التحميل"), "تعذر التحميل");
});
