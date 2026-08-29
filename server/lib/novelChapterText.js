function normalizeNovelParagraph(text) {
  return String(text || "")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/^[\s?•·|⭐️✨🌟—–\-]+/g, "")
    .replace(/[\s?•·|⭐️✨🌟—–\-]+$/g, "")
    .trim();
}

const NOVEL_BOILERPLATE_PATTERNS = [
  /حقوق\s*(?:التعريب|الرواية|النشر|الملكية)/i,
  /محفوظة?\s*ل(?:لمترجم|لفريق|للمدقق)/i,
  /قراءة\s*ممتعة/i,
  /فريق\s*التعريب/i,
  /لورد\s*غوامض/i,
  /ward\s*ghawamid/i,
  /ترجمة\s*حصرية/i,
  /لا\s*تنس(?:وا|ى)\s*(?:دعم|الاشتراك)/i,
  /ادعم(?:وا)?\s*المترجم/i,
  /تم\s*التعريب\s*بواسطة/i,
  /جميع\s*الحقوق\s*محفوظة/i,
  /نشر(?:ت|ة)?\s*(?:على|بواسطة)\s*(?:فريق|موقع)/i,
  /t\.me\/\S+/i,
  /discord\.gg\/\S+/i,
];

export function isNovelBoilerplateParagraph(text) {
  const normalized = normalizeNovelParagraph(text);
  if (!normalized) return true;
  if (NOVEL_BOILERPLATE_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  if (
    normalized.length <= 260
    && /(?:حقوق|محفوظة|قراءة\s*ممتعة)/i.test(normalized)
    && /(?:مترجم|مدقق|تعريب|فريق)/i.test(normalized)
  ) {
    return true;
  }
  const letters = normalized.replace(/[^\p{L}\p{N}]/gu, "");
  if (
    normalized.length <= 280
    && letters.length < normalized.length * 0.5
    && /(?:حقوق|مترجم|تعريب|قراءة\s*ممتعة)/i.test(normalized)
  ) {
    return true;
  }
  return false;
}

export function filterNovelParagraphs(paragraphs = []) {
  return paragraphs.filter((paragraph) => !isNovelBoilerplateParagraph(paragraph));
}
