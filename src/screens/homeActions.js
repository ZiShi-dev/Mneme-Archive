import { fetchSourceDetails } from "../features/sources/sourceApi.js";
import { resolveBookmarkType } from "../features/sources/contentTypes.js";
import { isVideoMediaType } from "../features/sources/mediaPresentation.js";
import { findChapterByRecord } from "../lib/readingProgress.js";
import { liveReaderPrefetchOptions, prefetchReaderChapter } from "../lib/reading/readerChapterCache.js";
import { isUsableChapterUrl, resolveHomeContinueAction } from "../lib/updates/homeLatestModel.js";

export { liveReaderPrefetchOptions, prefetchReaderChapter } from "../lib/reading/readerChapterCache.js";

export function prefetchLiveTitle(item, chapter) {
  if (!item?.url || !item.sourceId) return;
  void fetchSourceDetails(item.sourceId, item.url);
  prefetchReaderChapter(item.sourceId, chapter, item);
  if (isVideoMediaType(resolveBookmarkType(item))) {
    void import("../features/sources/LiveVideoPlayer");
  }
}

export async function resolveLiveContinueChapter(item, chapter, record) {
  if (isUsableChapterUrl(chapter?.url)) return chapter;

  const lookupRecord = {
    chapterUrl: chapter?.url || record?.chapterUrl,
    chapterNumber: chapter?.number ?? record?.chapterNumber,
    chapterName: chapter?.name ?? record?.chapterName,
  };

  const details = await fetchSourceDetails(item.sourceId, item.url).catch(() => null);
  const chapters = details?.chapters || item.recentChapters || [];
  const resolved = findChapterByRecord(chapters, lookupRecord);
  if (resolved?.url) return resolved;

  return null;
}

export async function continueHomeReading(entry, {
  openManga,
  openReader,
  openLiveManga,
  openLiveReader,
  navigate,
} = {}) {
  const action = resolveHomeContinueAction(entry);
  if (action.type === "navigate") {
    navigate?.(action.screen);
    return;
  }
  if (action.type === "demo-reader") {
    openReader?.(action.item, action.chapter);
    return;
  }
  if (action.type === "demo-details") {
    openManga?.(action.item);
    return;
  }
  if (action.type === "live-reader") {
    openLiveReader?.(action.item, action.chapter, liveReaderPrefetchOptions(action.item, action.chapter));
    return;
  }
  if (action.type === "live-reader-resolve") {
    const chapter = await resolveLiveContinueChapter(action.item, action.chapter, action.record);
    if (chapter?.url && isUsableChapterUrl(chapter.url)) {
      openLiveReader?.(action.item, chapter, liveReaderPrefetchOptions(action.item, chapter));
      return;
    }
    openLiveManga?.(action.item);
    return;
  }
  openLiveManga?.(action.item);
}
