export function appendUniqueCatalogItems(pool, seen, items = []) {
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    pool.push(item);
  }
}

/**
 * Collecte paginée avec spill multi-pages et saut intelligent pour catalogues denses.
 */
export async function collectCatalogPool(fetchUpstream, {
  offset,
  pageSize,
  maxUpstreamEnd,
  upstreamPageHint = 24,
}) {
  const seen = new Set();
  const pool = [];
  let hasMoreUpstream = true;

  const ingestPair = async (startPage) => {
    const [current, next] = await Promise.all([
      fetchUpstream(startPage).catch(() => ({ items: [], hasMore: false })),
      startPage < maxUpstreamEnd
        ? fetchUpstream(startPage + 1).catch(() => ({ items: [], hasMore: false }))
        : Promise.resolve({ items: [], hasMore: false }),
    ]);
    let progressed = false;
    let density = 0;
    for (const upstream of [current, next]) {
      const before = pool.length;
      appendUniqueCatalogItems(pool, seen, upstream.items);
      if (pool.length > before) progressed = true;
      density = Math.max(density, upstream.items.length);
      hasMoreUpstream = hasMoreUpstream || upstream.hasMore;
    }
    if (!progressed) hasMoreUpstream = false;
    return density || upstreamPageHint;
  };

  if (offset <= 0) {
    let upstreamPage = 1;
    while (pool.length < pageSize && hasMoreUpstream && upstreamPage <= maxUpstreamEnd) {
      await ingestPair(upstreamPage);
      upstreamPage += 2;
    }
    return { pool, hasMoreUpstream };
  }

  const density = await ingestPair(1);
  if (pool.length >= offset + pageSize) {
    return { pool, hasMoreUpstream };
  }

  const jumpTo = Math.max(3, Math.floor(offset / Math.max(density, 1)) + 1);
  const needsJump = jumpTo >= 3 && offset >= density * 2;
  if (needsJump && jumpTo <= maxUpstreamEnd) {
    pool.length = 0;
    seen.clear();
    hasMoreUpstream = true;
    const innerOffset = Math.max(0, offset - (jumpTo - 1) * density);
    let upstreamPage = jumpTo;
    while (pool.length < innerOffset + pageSize && hasMoreUpstream && upstreamPage <= maxUpstreamEnd) {
      await ingestPair(upstreamPage);
      upstreamPage += 2;
    }
    return {
      pool: pool.slice(innerOffset, innerOffset + pageSize + 1),
      hasMoreUpstream,
      sliced: true,
    };
  }

  let upstreamPage = 3;
  while (pool.length < offset + pageSize && hasMoreUpstream && upstreamPage <= maxUpstreamEnd) {
    await ingestPair(upstreamPage);
    upstreamPage += 2;
  }
  return { pool, hasMoreUpstream };
}
