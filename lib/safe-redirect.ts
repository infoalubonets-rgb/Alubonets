/**
 * A `?next=` value that is safe to redirect to: a path on this site only. Rejects absolute URLs,
 * protocol-relative `//host`, and backslash forms like `/\host` that browsers treat as `//host`.
 */
export function safeRedirectPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  if (/[\\\s]/.test(next) || /[\u0000-\u001f\u007f]/.test(next)) return null
  try {
    // Resolving against a dummy origin must keep that origin, or the value pointed elsewhere.
    const url = new URL(next, 'https://alubonets.invalid')
    if (url.origin !== 'https://alubonets.invalid') return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}
