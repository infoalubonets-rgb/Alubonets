import { describe, expect, it } from 'vitest'
import { normalizeSupabaseUrl } from '../lib/supabase-url'

describe('normalizeSupabaseUrl', () => {
  it('removes a trailing slash', () => {
    expect(normalizeSupabaseUrl('https://example.supabase.co/')).toBe(
      'https://example.supabase.co',
    )
  })

  it('removes an accidental REST suffix', () => {
    expect(normalizeSupabaseUrl('https://example.supabase.co/rest/v1')).toBe(
      'https://example.supabase.co',
    )
  })
})
