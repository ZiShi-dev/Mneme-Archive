import { getSourceProfile, resolveSourceId } from "../../config/sources.js";

export function inferFollowMediaType(item) {
  if (item?.mediaType) return item.mediaType;
  const sourceId = resolveSourceId(item);
  const types = getSourceProfile(sourceId).contentTypes || ["manga"];
  const label = item?.mediaTypeLabel || "";
  if (/رواية|novel/i.test(label)) return "novel";
  if (/مسلسل|s[eéè]rie|series/i.test(label)) return "series";
  if (/فيلم|movie/i.test(label)) return "movie";
  if (/أنمي|anime/i.test(label)) return "anime";
  if (types.includes("anime") && !types.includes("manga") && !types.includes("novel")) {
    return "anime";
  }
  if (types.length === 1) return types[0];
  if (types.includes("movie") && !types.includes("manga") && !types.includes("novel")) return "movie";
  return "manga";
}
