import { peekSourceChapter } from "../../features/sources/sourceApi.js";
import { estimateNovelDownloadBatch as estimateNovelDownloadBatchCore } from "./estimateNovelDownloadSize.js";

export function estimateNovelDownloadBatch(sourceId, chapters, manga, rawDownloads) {
  return estimateNovelDownloadBatchCore(sourceId, chapters, manga, rawDownloads, {
    peekChapter: peekSourceChapter,
  });
}
