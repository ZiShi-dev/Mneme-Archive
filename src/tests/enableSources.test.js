import test from "node:test";
import assert from "node:assert/strict";
import {
  collectSourceLanguages,
  filterEnableSources,
  isSourceEnabled,
  wouldLeaveNoEnabledSource,
} from "../features/sources/enableSources.js";

const sources = [
  { id: "mangalik", enabled: true },
  { id: "frenchstream", enabled: false },
  { id: "wiflix", enabled: true },
  { id: "anime4up", enabled: true },
];

test("filterEnableSources matches language labels in Arabic", () => {
  const english = filterEnableSources(sources, { query: "الإنجليزية" });
  assert.deepEqual(english.map((entry) => entry.id).sort(), ["frenchstream", "wiflix"]);
});

test("filterEnableSources filters by content type and enabled scope", () => {
  const movies = filterEnableSources(sources, { type: "movie", scope: "enabled" });
  assert.deepEqual(movies.map((entry) => entry.id).sort(), ["anime4up", "wiflix"]);
});

test("filterEnableSources filters by language code", () => {
  const french = filterEnableSources(sources, { language: "fr" });
  assert.deepEqual(french.map((entry) => entry.id).sort(), ["frenchstream", "wiflix"]);
});

test("collectSourceLanguages returns present languages in display order", () => {
  assert.deepEqual(collectSourceLanguages(sources), ["ar", "fr", "en"]);
});

test("wouldLeaveNoEnabledSource blocks disabling the last active source", () => {
  const onlyOne = [
    { id: "mangalik", enabled: true },
    { id: "wiflix", enabled: false },
  ];
  assert.equal(wouldLeaveNoEnabledSource(onlyOne, "mangalik"), true);
  assert.equal(wouldLeaveNoEnabledSource(onlyOne, "wiflix"), false);
  assert.equal(wouldLeaveNoEnabledSource(sources, "wiflix"), false);
});

test("isSourceEnabled treats missing enabled as active", () => {
  assert.equal(isSourceEnabled({ id: "mangalik" }), true);
  assert.equal(isSourceEnabled({ id: "mangalik", enabled: false }), false);
});
