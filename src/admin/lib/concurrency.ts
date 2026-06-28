/**
 * Map over items running at most `limit` async tasks at once, preserving input
 * order in the result. Used to overlap independent GitHub blob fetches (backup,
 * template update) instead of awaiting them one at a time, while staying under a
 * modest cap so we don't trip GitHub's secondary rate limits.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
