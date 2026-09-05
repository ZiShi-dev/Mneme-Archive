export function isEmbedOnlyPlaybackSource(source = {}) {
  return Boolean(source?.url) && !source?.streamUrl;
}

function normalizeSkipIndexes(skipIndexes) {
  if (skipIndexes instanceof Set) return skipIndexes;
  if (Array.isArray(skipIndexes)) return new Set(skipIndexes);
  return new Set();
}

/**
 * Prochain serveur à essayer après une erreur de lecture.
 * Parcourt d'abord les serveurs suivants, puis les précédents non encore essayés.
 * Priorité aux flux directs (HLS) parmi les candidats restants.
 */
export function findNextPlaybackSourceIndex(sources = [], currentIndex = 0, skipIndexes = new Set()) {
  const skip = normalizeSkipIndexes(skipIndexes);
  const candidates = [];

  for (let index = currentIndex + 1; index < sources.length; index += 1) {
    if (!skip.has(index)) candidates.push(index);
  }
  for (let index = 0; index < currentIndex; index += 1) {
    if (!skip.has(index)) candidates.push(index);
  }

  if (!candidates.length) return -1;

  const hlsPreferred = candidates.find((index) => sources[index]?.streamUrl);
  return hlsPreferred ?? candidates[0];
}
