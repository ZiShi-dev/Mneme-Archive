import { t } from "../../i18n/runtime.js";
import { getMediaPresentation } from "../../features/sources/mediaPresentation.js";
import { inferFollowMediaType } from "./followMediaType.js";

export function resolveFollowMediaType(input) {
  return inferFollowMediaType(input);
}

function presentationFor(mediaType) {
  return getMediaPresentation(mediaType || "manga");
}

function isEpisodeFollowType(mediaType) {
  const presentation = presentationFor(mediaType);
  return presentation.isVideo && mediaType !== "movie";
}

export function describeFollowInterval(interval, mediaType = "manga") {
  const value = Math.max(1, Number(interval) || 1);
  const { units } = presentationFor(mediaType);

  if (mediaType === "movie") {
    return value === 1 ? t("follow.anyUpdate") : t("follow.everyNUpdates", { n: value });
  }

  if (value === 1) {
    if (isEpisodeFollowType(mediaType)) return t("follow.everyEpisode");
    return t("follow.everyChapter");
  }

  return t("follow.everyNUnits", { n: value, units });
}

export function describeFollowHint(interval, mediaType = "manga") {
  const value = Math.max(1, Number(interval) || 1);

  if (mediaType === "movie") {
    return value === 1
      ? t("follow.hintMovie1")
      : t("follow.hintMovieN", { n: value });
  }

  if (isEpisodeFollowType(mediaType)) {
    return value === 1
      ? t("follow.hintEpisode1")
      : t("follow.hintEpisodeN", { n: value });
  }

  return value === 1
    ? t("follow.hintChapter1")
    : t("follow.hintChapterN", { n: value });
}

export function buildFollowUpdateLabel(preference, newCount = 1) {
  const mediaType = resolveFollowMediaType(preference);
  const interval = Math.max(1, Number(preference?.interval) || 1);
  const { units } = presentationFor(mediaType);

  if (mediaType === "movie") {
    if (newCount > 1) return t("follow.nMovieUpdates", { n: newCount });
    return interval <= 1 ? t("follow.newUpdate") : t("follow.newUpdateEvery", { n: interval });
  }

  if (newCount > 1) return t("follow.nNewUnits", { n: newCount, units });

  const unitLabel = isEpisodeFollowType(mediaType) ? t("follow.newEpisode") : t("follow.newChapter");
  if (interval <= 1) return unitLabel;
  return `${unitLabel} · ${t("follow.everyN", { n: interval })}`;
}

export function formatFollowUpdateLine(event) {
  const mediaType = event.mediaType || "manga";
  const presentation = presentationFor(mediaType);
  const chapterNumber = event.chapterNumber || "";
  const chapterName = event.chapterName || "";
  const suffix = chapterName && chapterName !== chapterNumber ? ` · ${chapterName}` : "";

  if (mediaType === "movie") {
    return chapterName ? `${presentation.rowPrefix} · ${chapterName}` : presentation.rowPrefix;
  }

  return `${presentation.rowPrefix} ${chapterNumber}${suffix}`;
}

export function formatFollowNotificationBody(event) {
  const line = formatFollowUpdateLine(event);
  const label = event.label || t("follow.newUpdate");
  return `${line} · ${label}`;
}

export function followSheetIntervalQuestion(mediaType = "manga") {
  if (mediaType === "movie") return t("follow.howManyUpdates");
  if (isEpisodeFollowType(mediaType)) return t("follow.howManyEpisodes");
  return t("follow.howManyChapters");
}

export function followPresetLabel(preset, mediaType = "manga") {
  if (preset === 1) {
    if (mediaType === "movie") return t("follow.everyUpdate");
    if (isEpisodeFollowType(mediaType)) return t("follow.everyEpisode");
    return t("follow.everyChapter");
  }
  return t("follow.everyN", { n: preset });
}
