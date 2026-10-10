/**
 * A thrown ZodError's message is the JSON list of issues; show the first issue's text instead
 * of the raw JSON when a server action rejects a form.
 */
export function readableError(cause: unknown, fallback: string) {
  const message = cause instanceof Error ? cause.message.trim() : ''
  if (message.startsWith('[')) {
    try {
      const issues = JSON.parse(message) as { message?: string }[]
      if (Array.isArray(issues) && issues[0]?.message) return issues[0].message
    } catch {}
    return fallback
  }
  return message || fallback
}
