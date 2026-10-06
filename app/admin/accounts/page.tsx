import { redirect } from 'next/navigation'

/** Accounts merged into the shared Members page; keep old links and filters working. */
export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = new URLSearchParams()
  for (const key of ['q', 'role'] as const) {
    const value = (await searchParams)[key]
    if (typeof value === 'string' && value) params.set(key, value)
  }
  const qs = params.toString()
  redirect(qs ? `/directory?${qs}` : '/directory')
}
