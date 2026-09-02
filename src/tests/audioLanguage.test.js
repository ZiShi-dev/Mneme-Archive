import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAudioLanguageToChapter,
  filterItemsByAudioLanguage,
  itemMatchesAudioFilter,
  parseAudioLabelOptions,
  resolveAvailableAudioLanguages,
  resolveItemAudioOptions,
  sourceSupportsAudioFilter,
} from "../features/sources/audioLanguage.js";

test("parseAudioLabelOptions reads VF and VOSTFR combinations", () => {
  assert.deepEqual(parseAudioLabelOptions("VF+VOSTFR"), ["VF", "VOSTFR"]);
  assert.deepEqual(parseAudioLabelOptions("VOSTFR"), ["VOSTFR"]);
  assert.deepEqual(parseAudioLabelOptions("VF"), ["VF"]);
});

test("resolveAvailableAudioLanguages prefers chapter language map", () => {
  const languages = resolveAvailableAudioLanguages(
    { audioLabel: "VF" },
    [{
      url: "https://www.wiflix.tv/watch/demo?language=VF&episode=1",
      audioLanguages: {
        VF: "https://www.wiflix.tv/watch/demo?language=VF&episode=1",
        VOSTFR: "https://www.wiflix.tv/watch/demo?language=VOSTFR&episode=1",
      },
    }],
    "wiflix",
  );
  assert.deepEqual(languages, ["VF", "VOSTFR"]);
});

test("resolveAvailableAudioLanguages uses french stream availableAudioLanguages", () => {
  const languages = resolveAvailableAudioLanguages(
    { audioLabel: "VF", availableAudioLanguages: ["VF", "VOSTFR"] },
    [],
    "frenchstream",
  );
  assert.deepEqual(languages, ["VF", "VOSTFR"]);
});

test("applyAudioLanguageToChapter rewrites wiflix episode url", () => {
  const chapter = applyAudioLanguageToChapter({
    url: "https://www.wiflix.tv/watch/demo?language=VF&episode=3",
    number: "3",
    audioLanguages: {
      VF: "https://www.wiflix.tv/watch/demo?language=VF&episode=3",
      VOSTFR: "https://www.wiflix.tv/watch/demo?language=VOSTFR&episode=3",
    },
  }, "VOSTFR", "wiflix");
  assert.match(chapter.url, /language=VOSTFR&episode=3/);
  assert.equal(chapter.preferredAudioLanguage, "VOSTFR");
});

test("sourceSupportsAudioFilter covers video sources", () => {
  assert.equal(sourceSupportsAudioFilter("wiflix"), true);
  assert.equal(sourceSupportsAudioFilter("frenchstream"), true);
  assert.equal(sourceSupportsAudioFilter("mangalik"), false);
});

test("filterItemsByAudioLanguage keeps dual-audio and unknown labels", () => {
  const items = [
    { title: "VF only", audioLabel: "VF" },
    { title: "VOSTFR only", audioLabel: "VOSTFR" },
    { title: "Both", audioLabel: "VF+VOSTFR" },
    { title: "Unknown" },
  ];
  assert.deepEqual(filterItemsByAudioLanguage(items, "all").map((item) => item.title), ["VF only", "VOSTFR only", "Both", "Unknown"]);
  assert.deepEqual(filterItemsByAudioLanguage(items, "VF").map((item) => item.title), ["VF only", "Both"]);
  assert.deepEqual(filterItemsByAudioLanguage(items, "VOSTFR").map((item) => item.title), ["VOSTFR only", "Both"]);
  assert.equal(itemMatchesAudioFilter({ audioLabel: "VF+VOSTFR" }, "VF"), true);
  assert.equal(resolveItemAudioOptions({ availableAudioLanguages: ["VF", "VOSTFR"] }).length, 2);
});
