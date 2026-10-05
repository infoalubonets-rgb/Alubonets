import { redirect } from 'next/navigation'

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value)
  }
  const qs = params.toString()
  redirect(qs ? `/admin/accounts?${qs}` : '/admin/accounts')
}
