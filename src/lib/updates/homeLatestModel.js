import { sortChaptersDesc } from "../../../server/lib/chapterOrdering.js";

export function isUsableChapterUrl(url) {
  return Boolean(url) && !String(url).startsWith("demo-chapter:");
}

function chapterFromRecord(record) {
  if (!record) return null;
  return {
    url: record.chapterUrl,
    number: record.chapterNumber,
    name: record.chapterName || String(record.chapterNumber ?? ""),
  };
}

function titleReadingKey(item) {
  if (!item?.url && item?.id) return `demo:${item.id}`;
  return `${item.sourceId}:${item.url}`;
}

export function pickLatestChapter(chapters = [], fallback = null) {
  if (!chapters.length) return fallback;
  const sorted = sortChaptersDesc(chapters);
  const readable = sorted.find((chapter) => !chapter.locked);
  return readable || sorted[0] || fallback;
}

export function buildHomeLatestPayload(item, details = null) {
  const chapters = details?.chapters || item.recentChapters || [];
  const latestChapter = pickLatestChapter(chapters, item.recentChapters?.[0] || null);
  const mediaType = details?.mediaType || item.mediaType;
  return {
    item: {
      ...item,
      title: details?.title || item.title,
      altTitle: details?.altTitle || item.altTitle || "",
      cover: details?.cover || item.cover,
      mediaType,
      mediaTypeLabel: details?.mediaTypeLabel || item.mediaTypeLabel,
    },
    latestChapter,
    mediaType,
  };
}

export function isLatestChapterUnread(item, latestChapter, readingHistory = {}) {
  if (!latestChapter?.url) return false;
  const record = readingHistory[titleReadingKey(item)];
  if (!record?.chapterUrl) return true;
  if (record.chapterUrl === latestChapter.url) return false;

  const latestNumber = Number(latestChapter.number);
  const readNumber = Number(record.chapterNumber);
  if (Number.isFinite(latestNumber) && Number.isFinite(readNumber)) {
    return latestNumber > readNumber;
  }

  return true;
}

export function resolveHomeContinueAction(entry) {
  const target = entry?.target;
  const record = entry?.record;
  if (!target) return { type: "navigate", screen: "sources" };

  if (target.kind === "demo") {
    const chapterNumber = target.chapter?.number ?? target.chapter?.name;
    if (chapterNumber != null && chapterNumber !== "") {
      return { type: "demo-reader", item: target.item, chapter: chapterNumber };
    }
    return { type: "demo-details", item: target.item };
  }

  const chapter = target.chapter || chapterFromRecord(record);
  if (isUsableChapterUrl(chapter?.url)) {
    return { type: "live-reader", item: target.item, chapter };
  }

  const hasChapterHint = Boolean(
    chapter?.number
    || chapter?.name
    || record?.chapterNumber
    || record?.chapterName
    || chapter?.url,
  );
  if (hasChapterHint) {
    return { type: "live-reader-resolve", item: target.item, chapter, record };
  }

  return { type: "live-details", item: target.item };
}
