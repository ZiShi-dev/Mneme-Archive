import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFollowUpdateLabel,
  describeFollowHint,
  describeFollowInterval,
  formatFollowNotificationBody,
  formatFollowUpdateLine,
} from "../lib/updates/followMessaging.js";
import { buildFollowItem } from "../lib/updates/followKeys.js";

test("describeFollowInterval adapts labels for anime, series and movies", () => {
  assert.equal(describeFollowInterval(1, "anime"), "كل حلقة جديدة");
  assert.equal(describeFollowInterval(1, "series"), "كل حلقة جديدة");
  assert.equal(describeFollowInterval(2, "anime"), "كل 2 حلقات");
  assert.equal(describeFollowInterval(1, "movie"), "عند أي تحديث");
  assert.equal(describeFollowInterval(1, "novel"), "كل فصل جديد");
});

test("buildFollowUpdateLabel adapts update labels", () => {
  assert.equal(
    buildFollowUpdateLabel({ mediaType: "anime", interval: 1 }),
    "حلقة جديدة",
  );
  assert.equal(
    buildFollowUpdateLabel({ mediaType: "movie", interval: 1 }),
    "تحديث جديد",
  );
});

test("formatFollowUpdateLine and notification body use media units", () => {
  const animeEvent = {
    mediaType: "anime",
    chapterNumber: "8",
    chapterName: "8",
    label: "حلقة جديدة",
  };
  assert.equal(formatFollowUpdateLine(animeEvent), "الحلقة 8");
  assert.match(formatFollowNotificationBody(animeEvent), /الحلقة 8/);

  const movieEvent = {
    mediaType: "movie",
    chapterNumber: "1",
    chapterName: "نسخة مدبلجة",
    label: "تحديث جديد",
  };
  assert.equal(formatFollowUpdateLine(movieEvent), "الفيلم · نسخة مدبلجة");
});

test("describeFollowHint mentions episodes for anime", () => {
  assert.match(describeFollowHint(1, "anime"), /حلقة/);
  assert.match(describeFollowHint(1, "movie"), /فيلم/);
});

test("buildFollowItem infers anime media type from source", () => {
  const item = buildFollowItem({
    url: "https://anime4up.com/anime/test/",
    title: "Test Anime",
    sourceId: "anime4up",
  });
  assert.equal(item.mediaType, "anime");
});
