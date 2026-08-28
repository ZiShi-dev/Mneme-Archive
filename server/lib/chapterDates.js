export function parseChapterDateString(raw = "") {
  const value = String(raw || "").trim();
  if (!value) return null;

  const normalized = value
    .replace(/\u202f/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const dateTime = normalized.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dateTime) {
    const [, year, month, day, hour = "12", minute = "00", second = "00"] = dateTime;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const direct = Date.parse(normalized.replace(" ", "T"));
  if (!Number.isNaN(direct)) return new Date(direct).toISOString();

  const european = normalized.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (european) {
    const [, day, month, year, hour = "12", minute = "00"] = european;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    );
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return null;
}

export function enrichChapterDates(chapters = []) {
  return chapters.map((chapter) => {
    const publishedAt = chapter.publishedAt
      || parseChapterDateString(chapter.date)
      || parseChapterDateString(chapter.createdAt)
      || null;
    return publishedAt ? { ...chapter, publishedAt } : chapter;
  });
}

export function resolveLastUpdatedAt(chapters = [], fallback = "") {
  let latest = fallback ? parseChapterDateString(fallback) || fallback : "";
  let latestTs = latest ? new Date(latest).getTime() : 0;
  if (Number.isNaN(latestTs)) latestTs = 0;

  for (const chapter of chapters) {
    const candidate = chapter.publishedAt || parseChapterDateString(chapter.date);
    if (!candidate) continue;
    const ts = new Date(candidate).getTime();
    if (!Number.isNaN(ts) && ts > latestTs) {
      latestTs = ts;
      latest = candidate;
    }
  }

  return latest || "";
}
