import { fetchSourceChapter, peekSourceChapter } from "../../features/sources/sourceApi.js";

export function chapterDataMatchesUrl(data, chapterUrl) {
  if (!data || !chapterUrl) return false;
  if (data.url === chapterUrl) return true;
  try {
    const left = new URL(data.url, "https://local.invalid");
    const right = new URL(chapterUrl, "https://local.invalid");
    return left.pathname.replace(/\/$/, "") === right.pathname.replace(/\/$/, "");
  } catch {
    return false;
  }
}

export function buildChapterFetchOptions(sourceId, chapter, manga = {}, extra = {}) {
  return {
    contentApi: chapter?.contentApi,
    language: chapter?.preferredAudioLanguage || manga.preferredAudioLanguage || extra.language || "",
    seriesUrl: sourceId === "novelsparadise" ? manga.url : "",
    ...extra,
  };
}

export function resolveReaderChapterCache(sourceId, chapter, { prefetchData, manga = {}, ...extra } = {}) {
  const opts = buildChapterFetchOptions(sourceId, chapter, manga, extra);
  if (prefetchData && chapterDataMatchesUrl(prefetchData, chapter.url)) {
    return { data: prefetchData, opts };
  }
  return { data: peekSourceChapter(sourceId, chapter.url, opts), opts };
}

export function prefetchReaderChapter(sourceId, chapter, manga = {}, extra = {}) {
  if (!sourceId || !chapter?.url) return;
  const opts = buildChapterFetchOptions(sourceId, chapter, manga, extra);
  if (peekSourceChapter(sourceId, chapter.url, opts)) return;
  void fetchSourceChapter(sourceId, chapter.url, opts).catch(() => {});
}

export function liveReaderPrefetchOptions(item, chapter) {
  if (!item?.sourceId || !chapter?.url) return {};
  const cached = resolveReaderChapterCache(item.sourceId, chapter, { manga: item }).data;
  if (!cached) return {};
  return { prefetchData: { ...cached, url: chapter.url } };
}
