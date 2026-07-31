import Link from 'next/link'

type Props = {
  pathname: string
  page: number
  totalPages: number
  params?: Record<string, string | undefined>
}

export default function PaginationBar({ pathname, page, totalPages, params = {} }: Props) {
  if (totalPages <= 1) return null
  const prev = page > 1 ? page - 1 : null
  const next = page < totalPages ? page + 1 : null

  function href(p: number) {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') sp.set(k, v)
    }
    sp.set('page', String(p))
    return `${pathname}?${sp.toString()}`
  }

  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      {prev ? (
        <Link href={href(prev)} className="rounded-lg border px-3 py-1.5 text-primary">
          Previous
        </Link>
      ) : (
        <span className="rounded-lg border px-3 py-1.5 opacity-40">Previous</span>
      )}
      <span className="text-on-surface-variant">
        Page {page} of {totalPages}
      </span>
      {next ? (
        <Link href={href(next)} className="rounded-lg border px-3 py-1.5 text-primary">
          Next
        </Link>
      ) : (
        <span className="rounded-lg border px-3 py-1.5 opacity-40">Next</span>
      )}
    </nav>
  )
}
