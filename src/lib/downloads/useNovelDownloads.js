import { useCallback, useState } from "react";
import { usePersistedState } from "../../hooks/usePersistedState";
import {
  DOWNLOADS_STORAGE_KEY,
  EMPTY_DOWNLOADS,
  listDownloads,
  normalizeDownloads,
  removeDownloadItem,
} from "./downloadsModel.js";
import {
  downloadAllNovelChapters,
  downloadNovelChapter,
  removeNovelDownload,
} from "./novelDownloadService.js";

export function useNovelDownloads() {
  const [rawDownloads, setRawDownloads] = usePersistedState(DOWNLOADS_STORAGE_KEY, EMPTY_DOWNLOADS);
  const [batchProgress, setBatchProgress] = useState(null);
  const [busy, setBusy] = useState(false);

  const refreshDownloads = useCallback((store) => {
    setRawDownloads(normalizeDownloads(store));
  }, [setRawDownloads]);

  const downloadChapter = useCallback(async (item, chapter) => {
    setBusy(true);
    try {
      await downloadNovelChapter(item, chapter, { onStoreUpdate: refreshDownloads });
    } finally {
      setBusy(false);
    }
  }, [refreshDownloads]);

  const downloadAll = useCallback(async (item, chapters) => {
    setBusy(true);
    setBatchProgress({ completed: 0, total: chapters.length });
    try {
      await downloadAllNovelChapters(item, chapters, {
        onStoreUpdate: refreshDownloads,
        onProgress: ({ completed, total }) => {
          setBatchProgress({ completed, total });
        },
      });
    } finally {
      setBusy(false);
      setBatchProgress(null);
    }
  }, [refreshDownloads]);

  const removeDownload = useCallback(async (downloadItem) => {
    await removeNovelDownload(downloadItem);
    setRawDownloads((current) => removeDownloadItem(current, downloadItem.id));
  }, [setRawDownloads]);

  return {
    downloads: listDownloads(rawDownloads),
    rawDownloads,
    busy,
    batchProgress,
    downloadChapter,
    downloadAll,
    removeDownload,
  };
}

export function isChapterOfflineStatus(rawDownloads, sourceId, seriesUrl, chapterUrl) {
  const store = normalizeDownloads(rawDownloads);
  const id = `${String(sourceId || "")}::${String(seriesUrl || "")}`;
  const item = store.items.find((entry) => entry.id === id);
  if (!item) return false;
  return item.chapters.some((chapter) => chapter.url === chapterUrl && chapter.status === "complete");
}
