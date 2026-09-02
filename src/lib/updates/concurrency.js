export const DEFAULT_POOL_CONCURRENCY = 3;

export async function mapPool(items, concurrency, mapper) {
  if (!items?.length) return [];
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }));

  return results;
}
