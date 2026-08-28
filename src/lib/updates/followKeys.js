import { getSourceProfile, resolveSourceId } from "../../config/sources.js";
import { inferFollowMediaType } from "./followMediaType.js";

export function getFollowKey(item) {
  if (!item?.url && item?.id) return `demo:${item.id}`;
  return `${resolveSourceId(item)}:${item.url}`;
}

export function buildFollowItem(item) {
  const mediaType = inferFollowMediaType(item);
  return {
    url: item.url,
    title: item.title || "",
    altTitle: item.altTitle || item.subtitle || "",
    cover: item.cover || "",
    sourceId: resolveSourceId(item),
    mediaType,
    mediaTypeLabel: item.mediaTypeLabel || null,
  };
}

export const FOLLOW_INTERVAL_PRESETS = [1, 2, 3, 5, 10];

export { describeFollowHint, describeFollowInterval } from "./followMessaging.js";
