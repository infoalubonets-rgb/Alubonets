import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: 'Admin Dashboard — Alubonets SHG',
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
