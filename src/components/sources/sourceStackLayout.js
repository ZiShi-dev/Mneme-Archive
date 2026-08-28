export const DEFAULT_SOURCE_STACK_METRICS = {
  avatarSize: 27,
  overlap: 9,
};

export function measureSourceStackWidth(visibleCount, hiddenCount, metrics = DEFAULT_SOURCE_STACK_METRICS) {
  const { avatarSize, overlap } = metrics;
  if (visibleCount <= 0) return 0;

  const step = avatarSize - overlap;
  let width = avatarSize + (visibleCount - 1) * step;
  if (hiddenCount > 0) width += step;
  return width;
}

export function resolveVisibleSourceStackCount(
  totalCount,
  availableWidth,
  metrics = DEFAULT_SOURCE_STACK_METRICS,
) {
  if (totalCount <= 0) return { visible: 0, hidden: 0 };
  if (availableWidth <= 0) return { visible: 1, hidden: Math.max(0, totalCount - 1) };

  for (let visible = totalCount; visible >= 1; visible -= 1) {
    const hidden = totalCount - visible;
    if (measureSourceStackWidth(visible, hidden, metrics) <= availableWidth) {
      return { visible, hidden };
    }
  }

  return { visible: 1, hidden: totalCount - 1 };
}
