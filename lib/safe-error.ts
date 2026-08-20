const DATABASE_MARKERS = ['prisma', 'database server', 'pooler.supabase', 'p1001', 'p1002', 'connection_limit', 'query engine']
const NETWORK_MARKERS = ['fetch failed', 'networkerror', 'failed to fetch', 'econnrefused', 'enotfound', 'timeout']

export type FriendlyError = { title: string; message: string; code: string }

export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): FriendlyError {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const text = raw.toLowerCase()
  if (DATABASE_MARKERS.some((marker) => text.includes(marker)) || NETWORK_MARKERS.some((marker) => text.includes(marker))) {
    return { title: 'Service temporarily unavailable', message: 'We cannot connect to the service right now. Please wait a moment and try again.', code: 'SERVICE_UNAVAILABLE' }
  }
  if (text.includes('incorrect password') || text.includes('invalid login credentials') || text.includes('invalid email or password')) {
    return { title: 'Sign-in unsuccessful', message: 'The email address or password is incorrect. Please check your details and try again.', code: 'INVALID_CREDENTIALS' }
  }
  if (text.includes('too many') || text.includes('rate limit')) {
    return { title: 'Too many attempts', message: 'Please wait a few minutes before trying again.', code: 'RATE_LIMITED' }
  }
  if (text.includes('expired') || text.includes('no longer valid')) {
    return { title: 'Link expired', message: 'This link is no longer valid. Please request a new invitation.', code: 'EXPIRED' }
  }
  if (text.includes('unauthorized') || text.includes('forbidden') || text.includes('permission')) {
    return { title: 'Access denied', message: 'You do not have permission to perform this action.', code: 'FORBIDDEN' }
  }
  const unsafe = /[`]|\b(invocation|stack|sql|constraint|datasource|supabase|postgres|node_modules)\b/i.test(raw)
  return { title: 'Unable to complete request', message: unsafe || !raw ? fallback : raw, code: 'REQUEST_FAILED' }
}

export function publicErrorMessage(error: unknown, fallback?: string) {
  return friendlyError(error, fallback).message
}
