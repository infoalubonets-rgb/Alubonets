/** Returns a usable Sentry DSN, or undefined for placeholders / junk that would load bad scripts. */
export function resolveSentryDsn(raw: string | undefined): string | undefined {
  const dsn = raw?.trim()
  if (!dsn) return undefined
  if (/your-public-key|your-sentry-host|example\.com|localhost/i.test(dsn)) return undefined
  try {
    const url = new URL(dsn)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    if (!url.username || !url.hostname) return undefined
    return dsn
  } catch {
    return undefined
  }
}
