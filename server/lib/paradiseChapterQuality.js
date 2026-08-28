const PARADISE_JUNK_PARAGRAPH_RE = /\.shola-|function\s+sholaTab|#366ad3|wp-admin\/admin-ajax|chapter-countdown|\.shola-widget/i;
const HTML_LEAK_RE = /<\/?(?:p|div|span|style|script)\b/i;
const KOLNOVEL_DECOY_MERGE_RE = /(?:['\u2018\u2019]).{1,40}(?:['\u2019\u2018'])\s+\d+:/;

export function findParadiseChapterIssues(paragraphs = []) {
  const issues = [];
  if (!paragraphs.length) {
    issues.push("empty");
    return issues;
  }

  paragraphs.forEach((paragraph, index) => {
    if (!paragraph || paragraph.length < 2) issues.push(`short:${index}`);
    if (PARADISE_JUNK_PARAGRAPH_RE.test(paragraph)) issues.push(`junk:${index}`);
    if (HTML_LEAK_RE.test(paragraph)) issues.push(`html:${index}`);
    if (KOLNOVEL_DECOY_MERGE_RE.test(paragraph)) issues.push(`merged-decoy:${index}`);
  });

  const unique = new Set(paragraphs);
  if (unique.size < Math.max(1, Math.floor(paragraphs.length * 0.7))) {
    issues.push("heavy-duplication");
  }

  return [...new Set(issues)];
}

export function isParadiseChapterHealthy(paragraphs = []) {
  return findParadiseChapterIssues(paragraphs).length === 0;
}
