import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ account: vi.fn(), switch: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getAccountProfile: mocks.account }))
vi.mock('@/app/actions/workspace', () => ({ switchWorkspace: mocks.switch }))
import { POST } from '@/app/api/auth/workspace/route'
const request = (role: unknown, origin = 'http://localhost:3001') => new NextRequest('http://localhost:3001/api/auth/workspace', {
  method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
})
beforeEach(() => {
  vi.resetAllMocks()
  mocks.account.mockResolvedValue({ id: 'admin', status: 'ACTIVE' })
})
describe('stable workspace endpoint', () => {
  it('switches through the existing permission guard', async () => {
    expect((await POST(request('MEMBER'))).status).toBe(200)
    expect(mocks.switch).toHaveBeenCalledWith('MEMBER')
  })
  it('rejects a cross-site request before switching', async () => {
    expect((await POST(request('ADMIN', 'https://elsewhere.example'))).status).toBe(403)
    expect(mocks.switch).not.toHaveBeenCalled()
  })
  it('rejects expired sessions', async () => {
    mocks.account.mockResolvedValue(null)
    expect((await POST(request('MEMBER'))).status).toBe(401)
    expect(mocks.switch).not.toHaveBeenCalled()
  })
  it('returns a short message when a role is denied', async () => {
    mocks.switch.mockRejectedValue(new Error('internal failure'))
    const response = await POST(request('ADMIN'))
    expect(response.status).toBe(403)
    expect((await response.json()).error).not.toContain('internal failure')
  })
})
