export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function clampPageSize(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, Math.floor(limit)), MAX_PAGE_SIZE);
}

export function totalPages(total: number, pageSize: number): number {
  if (total <= 0) return 1;
  return Math.ceil(total / pageSize);
}

/** Google-style page number list with ellipses. */
export function getPageNumbers(current: number, pages: number): Array<number | "ellipsis"> {
  if (pages <= 1) return [1];
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, i) => i + 1);
  }

  const items: Array<number | "ellipsis"> = [1];

  if (current > 3) items.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(pages - 1, current + 1);

  for (let p = start; p <= end; p++) {
    items.push(p);
  }

  if (current < pages - 2) items.push("ellipsis");

  if (pages > 1) items.push(pages);

  return items;
}
