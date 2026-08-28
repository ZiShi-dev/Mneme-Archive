import { textOnly } from "./htmlUtils.js";

export function normalizePublicationStatus(raw = "") {
  const label = String(raw || "").trim();
  const value = label.toLocaleLowerCase("ar");
  if (!value) return { publicationStatus: "unknown", publicationStatusLabel: "" };
  if (/مكتمل|مكتملة|منته|منتهية|completed|complete|finished|ended|fin\b/i.test(value)) {
    return { publicationStatus: "completed", publicationStatusLabel: label };
  }
  if (/مستمر|مستمرة|ongoing|updating|airing|current|en cours/i.test(value)) {
    return { publicationStatus: "ongoing", publicationStatusLabel: label };
  }
  return { publicationStatus: "unknown", publicationStatusLabel: label };
}

export function parseMadaraPublicationStatus(html = "") {
  const paired = html.match(/summary-heading[\s\S]*?<h5[^>]*>\s*([^<]*)\s*<\/h5>[\s\S]*?summary-content[^>]*>([\s\S]*?)<\/div>/i);
  if (paired) {
    const heading = textOnly(paired[1]);
    const content = textOnly(paired[2]);
    if (content && /status|حالة|الحالة|état/i.test(heading)) {
      return normalizePublicationStatus(content);
    }
  }

  for (const match of html.matchAll(/<div[^>]*class="[^"]*post-content_item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)) {
    const block = match[1];
    const heading = textOnly(block.match(/summary-heading[\s\S]*?<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1] ?? "");
    const content = textOnly(block.match(/class=["'][^"']*summary-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
    if (!content) continue;
    if (/status|حالة|الحالة|état/i.test(heading) || /mg_status/i.test(match[0])) {
      return normalizePublicationStatus(content);
    }
  }
  const inline = textOnly(html.match(/<div[^>]*class="[^"]*post-status[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  return inline ? normalizePublicationStatus(inline) : { publicationStatus: "unknown", publicationStatusLabel: "" };
}

export function parseDooplayPublicationStatus(html = "") {
  for (const match of html.matchAll(/<span[^>]*class=["'][^"']*valor[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)) {
    const content = textOnly(match[1]);
    const context = html.slice(Math.max(0, match.index - 180), match.index + 80);
    if (/الحالة|status/i.test(context)) {
      return normalizePublicationStatus(content);
    }
  }
  return parseMadaraPublicationStatus(html);
}

export function resolvePublicationStatusFromBadges(badges = []) {
  for (const badge of badges) {
    const normalized = normalizePublicationStatus(badge);
    if (normalized.publicationStatus !== "unknown") return normalized;
  }
  return { publicationStatus: "unknown", publicationStatusLabel: "" };
}

export function parseGalaxyPublicationStatus(html = "") {
  const status = textOnly(html.match(/<b>([^<]+)<\/b>\s*<small>\s*الحالة\s*<\/small>/i)?.[1] ?? "");
  return normalizePublicationStatus(status);
}
