import { BookOpen, Clapperboard, Film, Layers3, Sparkles, Tv } from "lucide-react";
import { getSourceProfile, resolveSourceId } from "../../config/sources";
import { t } from "../../i18n/runtime.js";

const CONTENT_TYPE_DEFS = {
  all: { icon: Layers3, labelKey: "content.all", singularKey: "content.item" },
  manga: { icon: BookOpen, labelKey: "content.manga", singularKey: "content.mangaSingular" },
  novel: { icon: Sparkles, labelKey: "content.novel", singularKey: "content.novelSingular" },
  anime: { icon: Clapperboard, labelKey: "content.anime", singularKey: "content.animeSingular" },
  movie: { icon: Film, labelKey: "content.movie", singularKey: "content.movieSingular" },
  series: { icon: Tv, labelKey: "content.series", singularKey: "content.seriesSingular" },
};

export const contentTypes = Object.fromEntries(
  Object.entries(CONTENT_TYPE_DEFS).map(([id, def]) => [id, {
    icon: def.icon,
    get label() { return t(def.labelKey); },
    get singular() { return t(def.singularKey); },
  }]),
);

export function resolveBookmarkType(item) {
  if (!item) return "manga";
  const explicit = String(item.mediaType || "").toLowerCase();
  if (explicit === "novel" || explicit === "manga" || explicit === "anime" || explicit === "movie" || explicit === "series") return explicit;
  if (/رواية|novel/i.test(item.mediaTypeLabel || "")) return "novel";
  if (/مسلسل|series/i.test(item.mediaTypeLabel || "")) return "series";
  if (/أنمي|anime/i.test(item.mediaTypeLabel || "")) return "anime";
  if (/فيلم|movie/i.test(item.mediaTypeLabel || "")) return "movie";
  const sourceId = item.sourceId || resolveSourceId(item);
  const supported = getSourceProfile(sourceId).contentTypes || ["manga"];
  if (supported.length === 1) return supported[0];
  const isTextSource = supported.includes("manga") || supported.includes("novel");
  if (!isTextSource && supported.includes("anime")) {
    if (/فيلم|movie/i.test(item.mediaTypeLabel || "")) return "movie";
    return "anime";
  }
  if (!isTextSource && supported.includes("movie")) return "movie";
  return "manga";
}

export function getItemType(item) {
  return resolveBookmarkType(item);
}
