export function extractNumericCatalogId(item = {}) {
  const rawId = String(item.id ?? "").trim();
  if (/^\d+$/.test(rawId)) return Number(rawId);

  const url = String(item.url ?? "");
  const patterns = [
    /\/(\d{4,})-[^/]+\.html(?:[?#]|$)/i,
    /[?&]newsid=(\d+)/i,
  ];
  for (const pattern of patterns) {
    const value = Number(url.match(pattern)?.[1] || 0);
    if (value > 0) return value;
  }
  return 0;
}

function compareCatalogRecency(left, right) {
  const leftId = extractNumericCatalogId(left.item);
  const rightId = extractNumericCatalogId(right.item);
  if (leftId > 0 && rightId > 0 && leftId !== rightId) return rightId - leftId;
  if (leftId > 0 && rightId > 0) {
    if (left.index !== right.index) return left.index - right.index;
    return left.list - right.list;
  }

  const leftRank = left.index * 2 + left.list;
  const rightRank = right.index * 2 + right.list;
  return leftRank - rightRank;
}

export function mergeCatalogByRecency(left = [], right = []) {
  if (!left.length) return [...right];
  if (!right.length) return [...left];

  const merged = [
    ...left.map((item, index) => ({ item, index, list: 0 })),
    ...right.map((item, index) => ({ item, index, list: 1 })),
  ];
  merged.sort(compareCatalogRecency);
  return merged.map((entry) => entry.item);
}
