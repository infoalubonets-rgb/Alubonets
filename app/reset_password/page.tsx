import { redirect } from 'next/navigation'

/** Compatibility alias for mistyped / older reset links that use an underscore. */
export default async function ResetPasswordAliasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : ''
  redirect(token ? `/reset-password?token=${encodeURIComponent(token)}` : '/reset-password')
}
