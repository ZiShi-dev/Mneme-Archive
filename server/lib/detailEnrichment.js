import { enrichChapterDates, resolveLastUpdatedAt } from "./chapterDates.js";
import {
  normalizePublicationStatus,
  parseDooplayPublicationStatus,
  parseGalaxyPublicationStatus,
  parseMadaraPublicationStatus,
  resolvePublicationStatusFromBadges,
} from "./publicationStatus.js";

export function enrichSourceDetails(details = {}, { html = "", parser = "madara" } = {}) {
  const chapters = enrichChapterDates(details.chapters || []);
  let publication = {
    publicationStatus: details.publicationStatus || "unknown",
    publicationStatusLabel: details.publicationStatusLabel || "",
  };

  if (!details.publicationStatus || details.publicationStatus === "unknown") {
    if (parser === "galaxy") publication = parseGalaxyPublicationStatus(html);
    else if (parser === "dooplay") publication = parseDooplayPublicationStatus(html);
    else if (parser === "badges") publication = resolvePublicationStatusFromBadges(details.statusBadges || details.categories || []);
    else if (html) publication = parseMadaraPublicationStatus(html);
    else if (details.status) publication = normalizePublicationStatus(details.status);
  }

  const lastUpdatedAt = resolveLastUpdatedAt(chapters, details.lastUpdatedAt || details.updatedAt || "");

  return {
    ...details,
    ...publication,
    chapters,
    lastUpdatedAt,
  };
}
