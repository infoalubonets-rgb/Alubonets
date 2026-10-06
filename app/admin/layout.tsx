import DashboardUserProvider from '@/components/dashboard/DashboardUserProvider'
import { getSessionUser } from '@/lib/auth/session'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: 'Admin Dashboard — Alubonets SHG',
  },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  return <DashboardUserProvider user={user}>{children}</DashboardUserProvider>
}
