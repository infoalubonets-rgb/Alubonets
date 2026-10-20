import { afterEach, describe, expect, it, vi } from 'vitest'
import { appBaseUrl } from '@/lib/app-url'
afterEach(() => vi.unstubAllEnvs())
describe('email link origin', () => {
  it('uses the real production domain despite a retired deployment setting or request host', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://alubonets.vercel.app')
    expect(appBaseUrl('https://untrusted.example/api/auth/forgot-password')).toBe('https://www.alubonets.com')
    expect(appBaseUrl()).toBe('https://www.alubonets.com')
  })
  it('keeps a locally requested reset on the current development port', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://alubonets.vercel.app')
    expect(appBaseUrl('http://localhost:3001/api/auth/forgot-password')).toBe('http://localhost:3001')
    expect(appBaseUrl('http://127.0.0.1:3002/api/auth/forgot-password')).toBe('http://127.0.0.1:3002')
  })
  it('replaces retired configuration for emails generated without a request', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://alubonets.vercel.app')
    expect(appBaseUrl()).toBe('https://www.alubonets.com')
  })
  it('normalizes configured paths and trailing slashes', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.alubonets.com/')
    expect(appBaseUrl()).toBe('https://www.alubonets.com')
  })
})
