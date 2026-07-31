export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export function parsePage(raw: string | string[] | undefined, fallback = 1): number {
  const v = Array.isArray(raw) ? raw[0] : raw
  const n = Number(v)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.floor(n)
}

export function parsePageSize(
  raw: string | string[] | undefined,
  fallback = DEFAULT_PAGE_SIZE,
): number {
  const v = Array.isArray(raw) ? raw[0] : raw
  const n = Number(v)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(MAX_PAGE_SIZE, Math.floor(n))
}

export function paginationSkip(page: number, pageSize: number): number {
  return (Math.max(1, page) - 1) * pageSize
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)))
}

export function buildPageHref(
  pathname: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') sp.set(k, v)
  }
  sp.set('page', String(page))
  const q = sp.toString()
  return q ? `${pathname}?${q}` : pathname
}
