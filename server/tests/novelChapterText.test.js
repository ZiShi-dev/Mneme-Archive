import test from "node:test";
import assert from "node:assert/strict";
import { filterNovelParagraphs, isNovelBoilerplateParagraph } from "../lib/novelChapterText.js";

test("isNovelBoilerplateParagraph detects ward ghawamid translation credit", () => {
  const credit = "???? حقوق تعريب الرواية محفوظة للمترجم والمدقق لورد غوامض • قراءة ممتعة ????";
  assert.equal(isNovelBoilerplateParagraph(credit), true);
});

test("isNovelBoilerplateParagraph keeps normal story paragraphs", () => {
  assert.equal(isNovelBoilerplateParagraph("استيقظ لي مينغ مبكرًا ذلك اليوم وهو يشعر ببرودة غريبة في الهواء."), false);
  assert.equal(isNovelBoilerplateParagraph("قال المترجم له بصوت منخفض: لن نتراجع الآن."), false);
});

test("filterNovelParagraphs removes boilerplate lines only", () => {
  const paragraphs = [
    "فقرة افتتاحية من القصة.",
    "???? حقوق تعريب الرواية محفوظة للمترجم والمدقق لورد غوامض • قراءة ممتعة ????",
    "فقرة ثانية تتابع الأحداث.",
  ];
  assert.deepEqual(filterNovelParagraphs(paragraphs), [
    "فقرة افتتاحية من القصة.",
    "فقرة ثانية تتابع الأحداث.",
  ]);
});
