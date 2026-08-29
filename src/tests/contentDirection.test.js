import test from "node:test";
import assert from "node:assert/strict";
import { isRtlLanguageCode, resolveNovelContentDirection } from "../lib/text/contentDirection.js";

test("isRtlLanguageCode detects rtl languages", () => {
  assert.equal(isRtlLanguageCode("ar"), true);
  assert.equal(isRtlLanguageCode("en"), false);
  assert.equal(isRtlLanguageCode("zh"), false);
});

test("resolveNovelContentDirection prefers chapter language", () => {
  assert.equal(resolveNovelContentDirection({ contentLanguage: "en", fallback: "rtl" }), "ltr");
  assert.equal(resolveNovelContentDirection({ contentLanguage: "ar", fallback: "ltr" }), "rtl");
  assert.equal(resolveNovelContentDirection({ languages: ["en"], fallback: "rtl" }), "ltr");
  assert.equal(resolveNovelContentDirection({ languages: ["ar"], fallback: "ltr" }), "rtl");
});
