const REALM_LOCK_MARKERS = /(?:🔒|🔓|🔐|\u{1F512}|\u{1F513}|\u{1F510})/gu;

export function sanitizeRealmChapterLabel(name) {
  return String(name || "")
    .replace(REALM_LOCK_MARKERS, "")
    .replace(/\s*(?:مدفوع|مقفل)\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
