import { pickBestPlaybackSourceIndex, sortPlaybackSources } from "../../../lib/hls/playbackQuality.js";

export function chapterDataMatchesUrl(data, chapterUrl) {
  if (!data || !chapterUrl) return false;
  return data.url === chapterUrl || data.playerUrl === chapterUrl;
}

export function resolveCachedPlaybackData({ prefetchData, cached, chapterUrl } = {}) {
  if (chapterDataMatchesUrl(prefetchData, chapterUrl)) return prefetchData;
  if (cached) return cached;
  return null;
}

export function playbackSourcesFromChapterData(data) {
  return sortPlaybackSources(data?.sources?.length ? data.sources : []);
}

export function resolveActiveSourceIndex({
  data,
  preferredSourceIndex,
  preferDriveEmbed = false,
  applyPreferred = false,
} = {}) {
  const ranked = playbackSourcesFromChapterData(data);
  const preferred = applyPreferred && Number.isInteger(preferredSourceIndex)
    ? preferredSourceIndex
    : pickBestPlaybackSourceIndex(ranked, { preferDriveEmbed });
  return Math.max(0, Math.min(preferred, Math.max(ranked.length - 1, 0)));
}
