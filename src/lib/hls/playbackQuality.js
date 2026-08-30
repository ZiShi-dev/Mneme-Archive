const STREAM_HOST_RANK = [
  /vidzy\./i,
  /fsvid\./i,
  /filemoon\./i,
  /uqload\./i,
  /voe\.sx/i,
  /dood\./i,
];

function hostRankScore(url = "") {
  const index = STREAM_HOST_RANK.findIndex((pattern) => pattern.test(url));
  return index === -1 ? 0 : (STREAM_HOST_RANK.length - index) * 5;
}

function resolutionScore(value = "") {
  const match = String(value).match(/(\d{3,4})\s*p?/i);
  if (!match) return 0;
  return Math.min(Math.round(Number(match[1]) / 90), 12);
}

export function isDriveMkvStreamSource(source = {}) {
  const url = `${source.streamUrl || ""} ${source.url || ""}`;
  return Boolean(source.embeddedSubtitles)
    || (/drive\.usercontent\.google\.com/i.test(url) && /download\?id=/i.test(url));
}

export function findDriveEmbedSourceIndex(sources = []) {
  return sources.findIndex((source) => /\(Drive\)/i.test(source?.label || "")
    || /drive\.google\.com\/file\/d\/[^/]+\/preview/i.test(source?.url || ""));
}

export function shouldPreferDriveEmbed(sources = [], { preferDriveEmbed = false } = {}) {
  if (!preferDriveEmbed) return false;
  return sources.some(isDriveMkvStreamSource) && findDriveEmbedSourceIndex(sources) >= 0;
}

export function scorePlaybackSource(source = {}) {
  if (!source || typeof source !== "object") return 0;
  const url = `${source.streamUrl || ""} ${source.url || ""} ${source.label || ""}`;
  let score = 0;
  if (source.streamUrl) score += 100;
  if (source.streamType === "hls") score += 24;
  else if (/\.m3u8/i.test(url)) score += 16;
  score += hostRankScore(url);
  score += resolutionScore(url);
  score += resolutionScore(source.label);
  return score;
}

export function sortPlaybackSources(sources = []) {
  return [...sources].sort((left, right) => scorePlaybackSource(right) - scorePlaybackSource(left));
}

export function pickBestPlaybackSourceIndex(sources = [], options = {}) {
  const { preferDriveEmbed = false } = options;
  if (preferDriveEmbed) {
    const hasDirectMkv = sources.some(isDriveMkvStreamSource);
    const embedIndex = findDriveEmbedSourceIndex(sources);
    if (hasDirectMkv && embedIndex >= 0) return embedIndex;
  }

  const ranked = sortPlaybackSources(sources);
  if (!ranked.length) return 0;
  const best = ranked[0];
  const index = sources.findIndex((entry) => entry === best);
  return index >= 0 ? index : 0;
}

export function applyHlsStartLevel(hls, preferHighQuality = true) {
  if (!hls?.levels?.length || !preferHighQuality) return;
  const highest = hls.levels.length - 1;
  hls.currentLevel = highest;
}

export function applyPlyrHlsQualityMenu(hls, plyr) {
  if (!hls?.levels?.length || hls.levels.length < 2 || !plyr) return;

  const heights = [...new Set(
    hls.levels.map((level) => level.height).filter(Boolean),
  )].sort((left, right) => right - left);

  if (!heights.length) return;

  plyr.quality = {
    default: heights[0],
    options: heights,
    forced: true,
    onChange: (quality) => {
      const target = Number(quality);
      const levelIndex = hls.levels.findIndex((level) => level.height === target);
      if (levelIndex >= 0) hls.currentLevel = levelIndex;
    },
  };
}
