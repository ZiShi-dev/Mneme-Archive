import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAudioLanguageToChapter,
  parseAudioLabelOptions,
  resolveAvailableAudioLanguages,
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
