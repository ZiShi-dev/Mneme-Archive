export function isEmbedOnlyPlaybackSource(source = {}) {
  return Boolean(source?.url) && !source?.streamUrl;
}

/**
 * Prochain serveur à essayer après une erreur HLS : priorité aux flux directs (Plyr).
 */
export function findNextPlaybackSourceIndex(sources = [], currentIndex = 0) {
  for (let index = currentIndex + 1; index < sources.length; index += 1) {
    if (sources[index]?.streamUrl) return index;
  }
  for (let index = currentIndex + 1; index < sources.length; index += 1) {
    return index;
  }
  return -1;
}
