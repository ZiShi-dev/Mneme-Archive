import { resolveVideoPlayback } from "../mediaPresentation.js";
import { sourceStreamUrl, sourceSubtitleUrl } from "../sourceApi.js";

export function resolveLivePlayback({
  data,
  currentSource,
  preferEmbedPlayback,
  sourceId,
  activeChapterUrl,
}) {
  if (!data) return null;

  if (currentSource?.streamUrl && !preferEmbedPlayback) {
    const referer = currentSource.streamReferer || data.streamReferer || data.url || activeChapterUrl;
    return {
      mode: "hls",
      url: sourceStreamUrl(sourceId, currentSource.streamUrl, referer),
      referer,
    };
  }

  if (currentSource?.url) {
    return { mode: "embed", url: currentSource.url };
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

  if (data.embedUrl || resolved?.mode === "embed") {
    return { mode: "embed", url: data.embedUrl || resolved.url };
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
    url: sourceSubtitleUrl(sourceId, track.url, referer),
  }));
}
