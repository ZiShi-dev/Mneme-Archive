export const DEFAULT_VIDEO_PLAYER_HOST_ORDER = [
  /vidzy\./i,
  /fsvid\./i,
  /filemoon\./i,
  /uqload\./i,
  /voe\.sx/i,
  /dood\./i,
];

export function videoHostRank(url = "", hostOrder = DEFAULT_VIDEO_PLAYER_HOST_ORDER) {
  const index = hostOrder.findIndex((pattern) => pattern.test(url));
  return index === -1 ? hostOrder.length : index;
}

export function compareVideoHostRank(leftUrl = "", rightUrl = "", hostOrder = DEFAULT_VIDEO_PLAYER_HOST_ORDER) {
  return videoHostRank(leftUrl, hostOrder) - videoHostRank(rightUrl, hostOrder);
}

export function sortSourcesByVideoHost(sources = [], getUrl = (entry) => entry.url || "", hostOrder = DEFAULT_VIDEO_PLAYER_HOST_ORDER) {
  return [...sources].sort((left, right) => compareVideoHostRank(getUrl(left), getUrl(right), hostOrder));
}
