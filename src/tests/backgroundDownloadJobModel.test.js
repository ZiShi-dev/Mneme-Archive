import assert from "node:assert/strict";
import test from "node:test";
import {
  backgroundJobProgress,
  buildBackgroundJob,
  isActiveBackgroundJobStatus,
  isResumableBackgroundJob,
  normalizeBackgroundDownloadQueue,
  normalizeBackgroundJob,
} from "../lib/downloads/backgroundDownloadJobModel.js";

const item = {
  sourceId: "mangalik",
  title: "Test Manga",
  cover: "https://example.com/cover.jpg",
  url: "https://example.com/manga/1",
  mediaType: "manga",
};

const chapters = [
  { url: "https://example.com/c/1", number: "1", name: "Ch.1" },
  { url: "https://example.com/c/2", number: "2", name: "Ch.2" },
];

test("buildBackgroundJob creates a running job with chapter lookup map", () => {
  const job = buildBackgroundJob(item, chapters);
  assert.equal(job.id, "mangalik::https://example.com/manga/1");
  assert.equal(job.status, "running");
  assert.deepEqual(job.pendingUrls, chapters.map((chapter) => chapter.url));
  assert.equal(job.chapterByUrl.get(chapters[0].url)?.name, "Ch.1");
});

test("normalizeBackgroundJob recomputes pending urls after partial completion", () => {
  const job = normalizeBackgroundJob({
    id: "test",
    item,
    chapters,
    completedUrls: [chapters[0].url],
    failedUrls: [],
    status: "running",
  });
  assert.deepEqual(job.pendingUrls, [chapters[1].url]);
});

test("isResumableBackgroundJob accepts paused jobs with pending chapters", () => {
  const job = normalizeBackgroundJob({
    id: "test",
    item,
    chapters,
    completedUrls: [chapters[0].url],
    failedUrls: [],
    status: "paused",
  });
  assert.equal(isResumableBackgroundJob(job), true);
  assert.equal(isActiveBackgroundJobStatus("paused"), true);
});

test("normalizeBackgroundDownloadQueue drops invalid jobs", () => {
  const queue = normalizeBackgroundDownloadQueue({
    version: 1,
    jobs: [{ id: "bad" }, buildBackgroundJob(item, chapters)],
  });
  assert.equal(queue.jobs.length, 1);
  assert.equal(backgroundJobProgress(queue.jobs[0]).total, 2);
});
