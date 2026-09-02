export function isAzoraFlySource(sourceId) {
  return String(sourceId || "").toLowerCase() === "azorafly";
}

export function isRealmNovelSource(sourceId) {
  return String(sourceId || "").toLowerCase() === "realmnovel";
}

/** Catalogue / accueil : Realm Novel n’affiche jamais de cadenas (comme la fiche détail). */
export function isCatalogChapterBlocked(sourceId, chapter) {
  if (isRealmNovelSource(sourceId)) return false;
  return isAzoraChapterBlocked(sourceId, chapter);
}

/** Fiche détail : paywall visuel hors AzoraFly (Realm Novel reste ouvert). */
export function isDetailsChapterPaid(sourceId, chapter) {
  if (isRealmNovelSource(sourceId) || isAzoraFlySource(sourceId)) return false;
  return isChapterLocked(chapter);
}

export function parseUnlockAt(chapter) {
  const raw = typeof chapter === "string" || typeof chapter === "number"
    ? chapter
    : chapter?.unlockAt;
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return raw < 1e12 ? raw * 1000 : raw;
  }
  const time = Date.parse(String(raw));
  return Number.isFinite(time) ? time : null;
}

export function isChapterLocked(chapter) {
  return Boolean(chapter?.locked);
}

export function isChapterTimedLock(chapter) {
  if (!isChapterLocked(chapter)) return false;
  const at = parseUnlockAt(chapter);
  return at != null && at > Date.now();
}

export function isAzoraChapterBlocked(sourceId, chapter) {
  if (!isAzoraFlySource(sourceId) || !isChapterLocked(chapter)) return false;
  const at = parseUnlockAt(chapter);
  if (at == null) return true;
  return at > Date.now();
}

export function formatUnlockCountdown(msRemaining) {
  const total = Math.max(0, Math.floor((Number(msRemaining) || 0) / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600) % 24;
  const days = Math.floor(total / 86400);
  return { days, hours, minutes, seconds };
}

export function formatUnlockCountdownLabel(msRemaining) {
  const { days, hours, minutes, seconds } = formatUnlockCountdown(msRemaining);
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}
