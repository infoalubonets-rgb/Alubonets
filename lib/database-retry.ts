const TRANSIENT_DATABASE_CODES = new Set(['P1001', 'P1002', 'P1017', 'P2024'])

export function isTransientDatabaseError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String(error.code) : ''
  if (TRANSIENT_DATABASE_CODES.has(code)) return true
  const message = error instanceof Error ? error.message : String(error)
  return /can(?:not|'t) reach database server|server has closed the connection|connection (?:timed out|terminated)|timed out fetching a new connection/i.test(message)
}

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; delaysMs?: number[] } = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3)
  const delays = options.delaysMs ?? [150, 450]
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isTransientDatabaseError(error) || attempt === attempts - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, delays[attempt] ?? delays.at(-1) ?? 450))
    }
  }

  throw lastError
}
