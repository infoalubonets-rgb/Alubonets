'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type ReportsFilterValue = 'ALL' | 'MEETING' | 'REPORT'

type ReportsFilterContextValue = {
  filter: ReportsFilterValue
  setFilter: (value: ReportsFilterValue) => void
}

const ReportsFilterContext = createContext<ReportsFilterContextValue | null>(null)

export function ReportsFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<ReportsFilterValue>('ALL')
  return <ReportsFilterContext.Provider value={{ filter, setFilter }}>{children}</ReportsFilterContext.Provider>
}

export function useReportsFilter() {
  const ctx = useContext(ReportsFilterContext)
  if (!ctx) throw new Error('useReportsFilter must be used within a ReportsFilterProvider')
  return ctx
}
