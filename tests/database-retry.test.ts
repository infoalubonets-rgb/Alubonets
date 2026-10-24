import { describe, expect, it, vi } from 'vitest'
import { isTransientDatabaseError, withDatabaseRetry } from '@/lib/database-retry'

describe('database retry', () => {
  it('recognizes transient Prisma connection failures', () => {
    expect(isTransientDatabaseError(Object.assign(new Error("Can't reach database server"), { code: 'P1001' }))).toBe(true)
    expect(isTransientDatabaseError(Object.assign(new Error('Timed out fetching a new connection from the connection pool'), { code: 'P2024' }))).toBe(true)
    expect(isTransientDatabaseError(Object.assign(new Error('Bad query'), { code: 'P2002' }))).toBe(false)
  })

  it('retries a transient failure and returns the successful result', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("Can't reach database server"), { code: 'P1001' }))
      .mockResolvedValue('connected')

    await expect(withDatabaseRetry(operation, { delaysMs: [0] })).resolves.toBe('connected')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-transient query errors', async () => {
    const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    const operation = vi.fn().mockRejectedValue(error)
    await expect(withDatabaseRetry(operation, { delaysMs: [0] })).rejects.toBe(error)
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
