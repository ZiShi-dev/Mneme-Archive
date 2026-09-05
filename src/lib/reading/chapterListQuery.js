const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeChapterSearchText(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EXTENDED_ARABIC_INDIC.indexOf(digit)));
}

function chapterSearchHaystack(chapter) {
  const parts = [chapter?.number, chapter?.name, chapter?.title].filter(Boolean);
  const combined = normalizeChapterSearchText(parts.join(" "));
  const digitsOnly = combined.replace(/\D+/g, " ").trim();
  return digitsOnly ? `${combined} ${digitsOnly}` : combined;
}

export function chapterMatchesQuery(chapter, query) {
  const normalizedQuery = normalizeChapterSearchText(query);
  if (!normalizedQuery) return true;

  const haystack = chapterSearchHaystack(chapter);
  if (haystack.includes(normalizedQuery)) return true;

  const queryDigits = normalizedQuery.replace(/\D/g, "");
  if (!queryDigits) return false;

  const numberDigits = String(chapter?.number || "").replace(/\D/g, "");
  if (numberDigits && numberDigits.includes(queryDigits)) return true;

  const nameDigits = String(chapter?.name || "").replace(/\D/g, "");
  return Boolean(nameDigits && nameDigits.includes(queryDigits));
}
