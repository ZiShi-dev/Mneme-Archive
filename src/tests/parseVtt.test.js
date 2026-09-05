import test from "node:test";
import assert from "node:assert/strict";
import { findActiveCue, formatSubtitleText, parseVtt } from "../features/sources/liveVideo/parseVtt.js";

test("parseVtt reads cue timings and text", () => {
  const cues = parseVtt(`WEBVTT

1
00:00:01.000 --> 00:00:03.500
مرحبا

2
00:00:04.000 --> 00:00:06.000
الحلقة الأولى
`);

  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, "مرحبا");
  assert.equal(cues[1].start, 4);
});

test("findActiveCue returns the current subtitle line", () => {
  const cues = [{ start: 1, end: 3, text: "test" }];
  assert.equal(findActiveCue(cues, 2)?.text, "test");
  assert.equal(findActiveCue(cues, 5), null);
});

test("formatSubtitleText strips html and ass markup", () => {
  assert.equal(
    formatSubtitleText("ستكون هذه رحلتي الرسمية الأولى<b><i></i></b> إلى أراضي نبيل آخر"),
    "ستكون هذه رحلتي الرسمية الأولى إلى أراضي نبيل آخر",
  );
  assert.equal(formatSubtitleText("{\\i1}Bonjour"), "Bonjour");
  assert.equal(formatSubtitleText("<font color=\"#fff\">Test</font>"), "Test");
});
