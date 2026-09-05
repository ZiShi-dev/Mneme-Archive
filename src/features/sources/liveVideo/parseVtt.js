function parseTimestamp(value = "") {
  const match = String(value).trim().match(/(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})/);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const millis = Number(match[4] || 0);
  return (hours * 3600) + (minutes * 60) + seconds + (millis / 1000);
}

export function parseVtt(content = "") {
  const lines = String(content).replace(/\r/g, "").split("\n");
  const cues = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    index += 1;
    if (!line || line === "WEBVTT" || line.startsWith("NOTE") || line.startsWith("STYLE")) continue;

    let timingLine = line;
    if (!/-->/.test(timingLine) && index < lines.length) {
      timingLine = lines[index].trim();
      index += 1;
    }
    if (!/-->/.test(timingLine)) continue;

    const [startRaw, endRaw] = timingLine.split("-->").map((part) => part.trim());
    const textLines = [];
    while (index < lines.length && lines[index].trim() !== "") {
      textLines.push(lines[index]);
      index += 1;
    }
    const text = textLines.join("\n").trim();
    if (!text) continue;
    cues.push({
      start: parseTimestamp(startRaw),
      end: parseTimestamp(endRaw.split(/\s/)[0]),
      text,
    });
  }

  return cues.sort((left, right) => left.start - right.start);
}

export function formatSubtitleText(text = "") {
  return String(text)
    .replace(/\{\\[^}]*\}/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

export function findActiveCue(cues = [], currentTime = 0) {
  if (!cues.length || !Number.isFinite(currentTime)) return null;
  return cues.find((cue) => currentTime >= cue.start && currentTime <= cue.end) || null;
}
