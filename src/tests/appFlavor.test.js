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

test("archive flavor exposes all sources and media types", () => {
  assert.equal(isChromebookApp, false);
  assert.equal(ALLOWED_SOURCE_IDS, null);
  assert.deepEqual(VISIBLE_MEDIA_TYPES, ["manga", "novel", "anime", "movie", "series"]);
  assert.equal(DEFAULT_SOURCE_ID, "mangalik");
  assert.equal(PREFERRED_AUDIO_LANGUAGE, "VF");
  assert.equal(initialSources.length, 14);
  assert.ok(initialSources.some((entry) => entry.id === "mangalik"));
  assert.ok(initialSources.some((entry) => entry.id === "frenchstream"));
  assert.ok(initialSources.some((entry) => entry.id === "anime4up"));
  assert.ok(initialSources.some((entry) => entry.id === "animedar"));
});

test("itemOffersPreferredAudio uses preferred audio language and unknown labels", () => {
  assert.equal(itemOffersPreferredAudio({ audioLabel: "VF" }), true);
  assert.equal(itemOffersPreferredAudio({ audioLabel: "VF+VOSTFR" }), true);
  assert.equal(itemOffersPreferredAudio({ audioLabel: "VOSTFR" }), false);
  assert.equal(itemOffersPreferredAudio({ audioLabel: "VOSTFR" }, "VOSTFR"), true);
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
