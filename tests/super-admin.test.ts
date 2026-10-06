import { describe, expect, it } from 'vitest'
import { canRemoveSuperAdmin, grantMap } from '@/lib/super-admin'

// founder → alice → bob → carol ; dave is a second founder
const grants = grantMap([
  { id: 'founder', superAdminGrantedById: null },
  { id: 'alice', superAdminGrantedById: 'founder' },
  { id: 'bob', superAdminGrantedById: 'alice' },
  { id: 'carol', superAdminGrantedById: 'bob' },
  { id: 'dave', superAdminGrantedById: null },
])

describe('canRemoveSuperAdmin', () => {
  it('lets the granter remove the person they promoted', () => {
    expect(canRemoveSuperAdmin('alice', 'bob', grants)).toBe(true)
  })

  it('lets anyone higher up the chain remove them', () => {
    expect(canRemoveSuperAdmin('founder', 'carol', grants)).toBe(true)
  })

  it('never lets the promoted person remove whoever promoted them', () => {
    expect(canRemoveSuperAdmin('bob', 'alice', grants)).toBe(false)
    expect(canRemoveSuperAdmin('carol', 'founder', grants)).toBe(false)
  })

  it('protects founders, self-removal and other branches', () => {
    expect(canRemoveSuperAdmin('dave', 'founder', grants)).toBe(false)
    expect(canRemoveSuperAdmin('alice', 'alice', grants)).toBe(false)
    expect(canRemoveSuperAdmin('dave', 'bob', grants)).toBe(false)
  })

  it('stops on a broken loop instead of hanging', () => {
    const loop = grantMap([
      { id: 'x', superAdminGrantedById: 'y' },
      { id: 'y', superAdminGrantedById: 'x' },
    ])
    expect(canRemoveSuperAdmin('z', 'x', loop)).toBe(false)
  })
})
