const WATERMARK_BLOCK = /\uE000[\s\S]*?\uE001/g;
const WATERMARK_CHAR = /\uE000|\uE001/g;
const MOJIBAKE = /(?:\u00C3.|\u00C2.|\u00E2.|\u00EF\u00BF\u00BD|\uFFFD)/;
const ARABIC = /[\u0600-\u06FF]/;

function scoreDecodedText(text) {
  if (!text || typeof text !== "string") return -1000;
  const replacement = (text.match(/\uFFFD/g) || []).length * 10;
  const mojibake = (text.match(MOJIBAKE) || []).length * 8;
  const arabic = (text.match(ARABIC) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return arabic + latin - replacement - mojibake;
}

function repairEncoding(text) {
  if (
    typeof text !== "string"
    || WATERMARK_CHAR.test(text)
    || (!MOJIBAKE.test(text) && !text.includes("\uFFFD"))
    || ARABIC.test(text)
  ) {
    return text;
  }
  try {
    const cleaned = text.replace(/\u0000/g, "");
    const bytes = Uint8Array.from([...cleaned].map((char) => char.charCodeAt(0) & 255));
    const utf8 = new TextDecoder("utf-8").decode(bytes);
    const win1252 = new TextDecoder("windows-1252").decode(bytes);
    const best = [text, cleaned, utf8, win1252]
      .map((value) => ({ value, score: scoreDecodedText(value) }))
      .sort((a, b) => b.score - a.score)[0];
    return best && best.score > scoreDecodedText(text) ? best.value : text;
  } catch {
    return text;
  }
}

export function decodeNightNovelContent(raw = "") {
  const repaired = repairEncoding(String(raw || ""));
  return repaired
    .replace(WATERMARK_BLOCK, "")
    .replace(WATERMARK_CHAR, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitNightNovelParagraphs(raw = "") {
  const normalized = decodeNightNovelContent(raw);
  if (!normalized) return [];
  return normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
