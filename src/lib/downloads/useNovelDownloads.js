import { useCallback, useEffect, useState } from "react";
import { usePersistedState } from "../../hooks/usePersistedState";
import {
  DOWNLOADS_STORAGE_KEY,
  EMPTY_DOWNLOADS,
  buildDownloadId,
  listDownloads,
  normalizeDownloads,
  removeDownloadItem,
} from "./downloadsModel.js";
import {
  downloadAllChapters,
  downloadChapter as downloadChapterOffline,
  removeOfflineDownload,
} from "./chapterDownloadService.js";
import { isActiveBackgroundJobStatus } from "./backgroundDownloadJobModel.js";
import {
  cancelBackgroundDownload,
  enqueueBackgroundDownload,
  getBackgroundDownloadProgressForItem,
  pauseBackgroundDownload,
  resumeBackgroundDownload,
  subscribeBackgroundDownload,
  subscribeBackgroundDownloadStore,
} from "./backgroundDownloadRunner.js";

function resolveItemJobId(item) {
  return buildDownloadId(item?.sourceId, item?.url);
}

export function useNovelDownloads() {
  const [rawDownloads, setRawDownloads] = usePersistedState(DOWNLOADS_STORAGE_KEY, EMPTY_DOWNLOADS);
  const [batchProgress, setBatchProgress] = useState(null);
  const [backgroundProgress, setBackgroundProgress] = useState(null);
  const [busy, setBusy] = useState(false);

  const refreshDownloads = useCallback((store) => {
    setRawDownloads(normalizeDownloads(store));
  }, [setRawDownloads]);

  useEffect(() => {
    const unsubscribeStore = subscribeBackgroundDownloadStore(refreshDownloads);
    const unsubscribeProgress = subscribeBackgroundDownload((progress) => {
      setBackgroundProgress(
        progress && isActiveBackgroundJobStatus(progress.status) ? progress : null,
      );
    });
    return () => {
      unsubscribeStore();
      unsubscribeProgress();
    };
  }, [refreshDownloads]);

  const downloadChapter = useCallback(async (item, chapter) => {
    setBusy(true);
    try {
      await downloadChapterOffline(item, chapter, { onStoreUpdate: refreshDownloads });
    } finally {
      setBusy(false);
    }
  }, [refreshDownloads]);

  const downloadAll = useCallback(async (item, chapters) => {
    setBusy(true);
    setBatchProgress({ completed: 0, failed: 0, total: chapters.length });
    try {
      return await downloadAllChapters(item, chapters, {
        onStoreUpdate: refreshDownloads,
        onProgress: ({ completed, failed, total }) => {
          setBatchProgress({ completed, failed, total });
        },
      });
    } finally {
      setBusy(false);
      setBatchProgress(null);
    }
  }, [refreshDownloads]);

  const downloadAllInBackground = useCallback(async (item, chapters) => {
    const progress = await enqueueBackgroundDownload(item, chapters);
    setBackgroundProgress(progress);
    return progress;
  }, []);

  const loadBackgroundProgressForItem = useCallback(async (item) => {
    const progress = await getBackgroundDownloadProgressForItem(item);
    setBackgroundProgress((current) => {
      const jobId = resolveItemJobId(item);
      if (progress) return progress;
      return current?.jobId === jobId ? null : current;
    });
    return progress;
  }, []);

  const getBackgroundProgressForItem = useCallback((item) => {
    if (!item) return null;
    const jobId = resolveItemJobId(item);
    if (backgroundProgress?.jobId !== jobId) return null;
    if (!isActiveBackgroundJobStatus(backgroundProgress.status)) return null;
    return backgroundProgress;
  }, [backgroundProgress]);

  const pauseBackgroundDownloadForItem = useCallback(async (item) => {
    const result = await pauseBackgroundDownload(resolveItemJobId(item));
    if (result) setBackgroundProgress(result);
    return result;
  }, []);

  const resumeBackgroundDownloadForItem = useCallback(async (item) => {
    const result = await resumeBackgroundDownload(resolveItemJobId(item));
    if (result) setBackgroundProgress(result);
    return result;
  }, []);

  const cancelBackgroundDownloadForItem = useCallback(async (item) => {
    const jobId = resolveItemJobId(item);
    const result = await cancelBackgroundDownload(jobId);
    setBackgroundProgress((current) => (current?.jobId === jobId ? null : current));
    return result;
  }, []);

  const removeDownload = useCallback(async (downloadItem) => {
    await removeOfflineDownload(downloadItem);
    setRawDownloads((current) => removeDownloadItem(current, downloadItem.id));
  }, [setRawDownloads]);

  return {
    downloads: listDownloads(rawDownloads),
    rawDownloads,
    busy,
    batchProgress,
    backgroundProgress,
    downloadChapter,
    downloadAll,
    downloadAllInBackground,
    loadBackgroundProgressForItem,
    getBackgroundProgressForItem,
    pauseBackgroundDownloadForItem,
    resumeBackgroundDownloadForItem,
    cancelBackgroundDownloadForItem,
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
