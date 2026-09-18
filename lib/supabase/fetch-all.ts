// Supabase's API returns at most a fixed number of rows per request (the
// project's "Max rows" setting, 1,000 by default) and says nothing when it
// stops there. Lists, totals and exports that must be complete read page by
// page instead.

/** Must not be larger than the project's Max rows setting (default 1,000). */
const PAGE_SIZE = 1000;
const MAX_PAGES = 200;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Reads every row a query matches. `page(from, to)` must build the query with
 * a stable order (end with a unique column such as id) and `.range(from, to)`.
 */
export async function fetchAllRows<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) return rows;
  }
  throw new Error("Too many rows to read at once.");
}
