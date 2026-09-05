import { peekSourceChapter } from "../../features/sources/sourceApi.js";
import { estimateMangaDownloadBatch as estimateMangaDownloadBatchCore } from "./estimateMangaDownloadSize.js";

export function estimateMangaDownloadBatch(sourceId, chapters, manga, rawDownloads) {
  return estimateMangaDownloadBatchCore(sourceId, chapters, manga, rawDownloads, {
    peekChapter: peekSourceChapter,
  });
}
