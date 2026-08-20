import { describe, expect, it } from 'vitest'
import { friendlyError } from '../lib/safe-error'

describe('friendlyError', () => {
  it('never exposes Prisma/database connection details', () => {
    const result = friendlyError(new Error("Invalid `prisma.rateLimit.findUnique()` invocation: Can't reach database server at aws.pooler.supabase.com:6543"))
    expect(result.code).toBe('SERVICE_UNAVAILABLE')
    expect(result.message).not.toMatch(/prisma|supabase|6543|database server/i)
  })

  it('provides a useful wrong-password message', () => {
    const result = friendlyError('Incorrect password. Please try again.')
    expect(result.code).toBe('INVALID_CREDENTIALS')
    expect(result.message).toMatch(/email address or password/i)
  })

  it('preserves safe business validation messages', () => {
    expect(friendlyError('Phone number is required').message).toBe('Phone number is required')
  })

  it('hides technical implementation terms', () => {
    const result = friendlyError('SQL constraint failed in node_modules')
    expect(result.message).not.toMatch(/sql|node_modules/i)
  })
})
