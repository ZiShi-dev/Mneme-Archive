import { VISIBLE_MEDIA_TYPES } from "../../config/appFlavor.js";
import { contentTypes } from "../sources/contentTypes.js";
import { isVideoMediaType } from "../sources/mediaPresentation.js";

export const FAVORITE_TYPE_ORDER = ["manga", "novel", "anime", "movie", "series"];

export function isVisibleFavoriteType(mediaType, visibleTypes = VISIBLE_MEDIA_TYPES) {
  return visibleTypes.includes(mediaType);
}

export function countFavoritesByType(entries = []) {
  const counts = { all: entries.length, manga: 0, novel: 0, anime: 0, movie: 0, series: 0 };
  for (const entry of entries) {
    if (Object.hasOwn(counts, entry.type) && entry.type !== "all") counts[entry.type] += 1;
  }
  return counts;
}

export function favoriteTypeFilters(counts, visibleTypes = VISIBLE_MEDIA_TYPES) {
  const present = visibleTypes
    .filter((id) => (counts[id] || 0) > 0)
    .map((id) => ({ id, count: counts[id] }));
  if (present.length <= 1) return [];
  return [{ id: "all", count: counts.all || 0 }, ...present];
}

export function favoriteOverviewStats(counts) {
  return FAVORITE_TYPE_ORDER
    .filter((id) => (counts[id] || 0) > 0)
    .map((id) => ({
      id,
      count: counts[id],
      label: contentTypes[id]?.singular || id,
    }));
}

export function getBookmarkRowCopy(entry, latestChapter, t) {
  if (entry.kind === "demo") {
    return {
      typeLabel: t("content.mangaSingular"),
      readingLine: t("favorites.chapterOf", { current: entry.item.lastChapter, total: entry.item.chapters }),
      continueLabel: null,
      isVideo: false,
      isNovel: false,
    };
  }

  const typeLabel = contentTypes[entry.type]?.singular || t("content.mangaSingular");
  const isVideo = isVideoMediaType(entry.type);
  const chapterName = latestChapter?.number || latestChapter?.name || "?";

  if (entry.type === "movie") {
    return {
      typeLabel,
      readingLine: latestChapter
        ? t("favorites.watchMovie", { name: chapterName })
        : t("favorites.openMovie"),
      continueLabel: latestChapter?.url
        ? t("favorites.continueMovie", { name: chapterName })
        : null,
      isVideo,
      isNovel: false,
    };
  }

  if (isVideo) {
    return {
      typeLabel,
      readingLine: latestChapter
        ? t("favorites.lastEpisode", { name: chapterName })
        : t("favorites.openEpisodes"),
      continueLabel: latestChapter?.url
        ? t("favorites.continueEpisode", { name: chapterName })
        : null,
      isVideo,
      isNovel: false,
    };
  }

  return {
    typeLabel,
    readingLine: latestChapter
      ? t("favorites.lastChapter", { name: latestChapter.number || latestChapter.name })
      : t("favorites.openChapters"),
    continueLabel: latestChapter?.url
      ? t("favorites.continueChapter", { name: latestChapter.number || latestChapter.name })
      : null,
    isVideo: false,
    isNovel: entry.type === "novel",
  };
}
