import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_SOURCE_IDS,
  DEFAULT_SOURCE_ID,
  PREFERRED_AUDIO_LANGUAGE,
  VISIBLE_MEDIA_TYPES,
  isChromebookApp,
} from "../config/appFlavor.js";
import { initialSources } from "../config/sources.js";
import { filterItemsByAudioLanguage, itemOffersPreferredAudio } from "../features/sources/audioLanguage.js";

test("chromebook flavor keeps only French movie and series sources", () => {
  assert.equal(isChromebookApp, true);
  assert.deepEqual(ALLOWED_SOURCE_IDS, ["frenchstream", "wiflix", "coflix"]);
  assert.deepEqual(VISIBLE_MEDIA_TYPES, ["movie", "series"]);
  assert.equal(DEFAULT_SOURCE_ID, "frenchstream");
  assert.equal(PREFERRED_AUDIO_LANGUAGE, "VOSTFR");
  assert.deepEqual(initialSources.map((entry) => entry.id), ["frenchstream", "wiflix", "coflix"]);
});

test("itemOffersPreferredAudio keeps VOSTFR and unknown labels", () => {
  assert.equal(itemOffersPreferredAudio({ audioLabel: "VOSTFR" }), true);
  assert.equal(itemOffersPreferredAudio({ audioLabel: "VF+VOSTFR" }), true);
  assert.equal(itemOffersPreferredAudio({ audioLabel: "VF" }), false);
  assert.equal(itemOffersPreferredAudio({}), true);
});

test("filterItemsByAudioLanguage filters explicit audio choices", () => {
  assert.deepEqual(
    filterItemsByAudioLanguage([
      { title: "A", audioLabel: "VF" },
      { title: "B", audioLabel: "VOSTFR" },
    ], "VOSTFR").map((item) => item.title),
    ["B"],
  );
});
