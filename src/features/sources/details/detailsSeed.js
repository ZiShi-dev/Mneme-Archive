export function detailsItemFromSeed(seed = {}) {
  if (Array.isArray(seed.chapters) && seed.chapters.length) return seed;
  if (Array.isArray(seed.recentChapters) && seed.recentChapters.length) {
    return { ...seed, chapters: seed.recentChapters };
  }
  return seed;
}

/** Les chapitres catalogue (2 derniers) ne suffisent pas : attendre la fiche complète. */
export function detailsHasImmediateChapters(seed = {}, cached = null) {
  if (cached?.chapters?.length) return true;
  return Boolean(Array.isArray(seed.chapters) && seed.chapters.length);
}
