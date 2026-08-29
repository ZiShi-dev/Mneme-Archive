import test from "node:test";
import assert from "node:assert/strict";
import { getSourceDisplayName, getSourceLanguageLabels, sourceProfiles } from "../config/sources.js";

test("getSourceDisplayName uses Arabic name in Arabic locale", () => {
  assert.equal(getSourceDisplayName("wiflix", "ar"), "ويفليكس");
  assert.equal(getSourceDisplayName("wiflix", "fr"), "Wiflix");
});

test("getSourceLanguageLabels returns Arabic labels for Arabic sources", () => {
  assert.deepEqual(getSourceLanguageLabels("mangalik"), ["العربية"]);
  assert.deepEqual(getSourceLanguageLabels("anime4up"), ["العربية"]);
});

test("getSourceLanguageLabels returns French and English for VF/VOSTFR video sources", () => {
  assert.deepEqual(getSourceLanguageLabels("wiflix"), ["الفرنسية", "الإنجليزية"]);
  assert.deepEqual(getSourceLanguageLabels("frenchstream"), ["الفرنسية", "الإنجليزية"]);
});

test("getSourceLanguageLabels returns English for Dilar", () => {
  assert.deepEqual(getSourceLanguageLabels("dilar"), ["العربية"]);
});

test("every source profile exposes at least one language", () => {
  for (const profile of Object.values(sourceProfiles)) {
    assert.ok(getSourceLanguageLabels(profile).length >= 1, profile.id);
  }
});
