import test from "node:test";
import assert from "node:assert/strict";
import { parseChapterDateString, enrichChapterDates, resolveLastUpdatedAt } from "../lib/chapterDates.js";
import { normalizePublicationStatus, parseMadaraPublicationStatus } from "../lib/publicationStatus.js";
import { enrichSourceDetails } from "../lib/detailEnrichment.js";

test("parseChapterDateString parses common chapter dates", () => {
  const dateOnly = parseChapterDateString("2024-04-04");
  assert.ok(dateOnly);
  assert.match(dateOnly, /^2024-04-04T/);
  const dateTime = parseChapterDateString("2024-04-04 15:30");
  assert.equal(new Date(dateTime).getHours(), 15);
});

test("normalizePublicationStatus maps ongoing and completed labels", () => {
  assert.equal(normalizePublicationStatus("مستمرة").publicationStatus, "ongoing");
  assert.equal(normalizePublicationStatus("مكتملة").publicationStatus, "completed");
});

test("parseMadaraPublicationStatus reads madara status block", () => {
  const html = `
    <div class="post-content_item">
      <div class="summary-heading"><h5>الحالة</h5></div>
      <div class="summary-content">مستمر</div>
    </div>`;
  assert.equal(parseMadaraPublicationStatus(html).publicationStatus, "ongoing");
});

test("enrichSourceDetails adds publishedAt and lastUpdatedAt", () => {
  const details = enrichSourceDetails({
    chapters: [{ url: "/1", number: "2", date: "2024-04-04" }, { url: "/2", number: "1", date: "2024-03-01" }],
    status: "مكتملة",
  });
  assert.ok(details.chapters[0].publishedAt);
  assert.equal(details.publicationStatus, "completed");
  assert.ok(details.lastUpdatedAt);
});
