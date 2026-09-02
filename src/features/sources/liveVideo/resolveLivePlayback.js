import { resolveVideoPlayback } from "../mediaPresentation.js";
import { sourceStreamUrl, sourceSubtitleUrl } from "../sourceApi.js";
import { buildSourceEmbedUrl, usesSourceEmbedProxy } from "../../../lib/video/sourceEmbedProxy.js";

function resolveStreamPlaybackMode(streamUrl = "", streamType = "") {
  if (streamType === "hls" || /\.m3u8/i.test(streamUrl)) return "hls";
  return "video";
}

function resolveStreamFromSource(currentSource, sourceId, activeChapterUrl, data) {
  const referer = currentSource.streamReferer || data?.streamReferer || data?.url || activeChapterUrl;
  return {
    mode: resolveStreamPlaybackMode(currentSource.streamUrl, currentSource.streamType),
    url: sourceStreamUrl(sourceId, currentSource.streamUrl, referer),
    referer,
  };
}

export function resolveLivePlayback({
  data,
  currentSource,
  sourceId,
  activeChapterUrl,
}) {
  if (!data) return null;

  if (currentSource?.streamUrl) {
    return resolveStreamFromSource(currentSource, sourceId, activeChapterUrl, data);
  }

  if (currentSource?.url) {
    const referer = data?.streamReferer || data?.url || activeChapterUrl;
    const url = usesSourceEmbedProxy(sourceId, currentSource.url)
      ? buildSourceEmbedUrl(sourceId, currentSource.url, referer)
      : currentSource.url;
    return { mode: "embed", url };
  }

  const resolved = resolveVideoPlayback(data);
  if (resolved?.mode === "hls" && (data.streamUrl || data.videoUrl || resolved.url)) {
    const streamUrl = data.streamUrl || data.videoUrl || resolved.url;
    const referer = data.streamReferer || data.url || activeChapterUrl;
    return {
      mode: "hls",
      url: sourceStreamUrl(sourceId, streamUrl, referer),
      referer,
    };
  }

  if (resolved?.mode === "video" && (data.streamUrl || data.videoUrl || resolved.url)) {
    const streamUrl = data.streamUrl || data.videoUrl || resolved.url;
    const referer = data.streamReferer || data.url || activeChapterUrl;
    return {
      mode: "video",
      url: sourceStreamUrl(sourceId, streamUrl, referer),
      referer,
    };
  }

  if (data.embedUrl || resolved?.mode === "embed") {
    const referer = data.streamReferer || data.url || activeChapterUrl;
    const embedUrl = data.embedUrl || resolved.url;
    const url = usesSourceEmbedProxy(sourceId, embedUrl)
      ? buildSourceEmbedUrl(sourceId, embedUrl, referer)
      : embedUrl;
    return { mode: "embed", url };
  }

  return resolved;
}

export function buildSubtitleTracks({
  data,
  currentSource,
  embedMode,
  sourceId,
  activeChapterUrl,
}) {
  if (!data || embedMode) return [];
  const referer = currentSource?.streamReferer || data.streamReferer || data.url || activeChapterUrl;
  const tracks = currentSource?.subtitleTracks?.length
    ? currentSource.subtitleTracks
    : (data.subtitleTracks || []);
  return tracks.map((track) => ({
    ...track,
    url: sourceSubtitleUrl(sourceId, track.url, referer, { episodeId: track.episodeId }),
  }));
}
