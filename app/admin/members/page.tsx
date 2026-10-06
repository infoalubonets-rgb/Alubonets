import { redirect } from 'next/navigation'

/** Old admin members URL — the shared Members page replaced it. */
export default async function AdminMembersPage({
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
