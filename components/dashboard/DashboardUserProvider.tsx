'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { AuthUser } from '@/lib/auth/types'

const DashboardUserContext = createContext<AuthUser | null>(null)

export function useDashboardUser() {
  return useContext(DashboardUserContext)
}

export default function DashboardUserProvider({ user, children }: { user: AuthUser | null; children: ReactNode }) {
  return <DashboardUserContext.Provider value={user}>{children}</DashboardUserContext.Provider>
}
