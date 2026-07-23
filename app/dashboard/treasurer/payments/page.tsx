import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import TreasurerPaymentsClient from '@/components/dashboard/TreasurerPaymentsClient'

export const metadata = { title: 'M-Pesa Payments' }

export default async function TreasurerPaymentsPage() {
  const [successPayments, failedPayments] = await Promise.all([
    prisma.contribution.findMany({
      where: { paymentMethod: 'MPESA' },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { action: 'MPESA_STK_FAILED' },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Last 6 months chart
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString('en-KE', { month: 'short', year: '2-digit' }),
    }
  })
  const chartLabels = months.map((m) => m.label)
  const chartValues = months.map(({ year, month }) =>
    successPayments
      .filter((p) => {
        const d = new Date(p.paidAt)
        return d.getFullYear() === year && d.getMonth() === month
      })
      .reduce((s, p) => s + p.amount, 0),
  )

  return (
    <DashboardShell role="TREASURER" title="M-Pesa Payments" nav={TREASURER_NAV}>
      <TreasurerPaymentsClient
        successPayments={successPayments.map((p) => ({
          id: p.id,
          amount: p.amount,
          paidAt: p.paidAt.toISOString(),
          mpesaRef: p.mpesaRef,
          description: p.description,
          user: p.user,
        }))}
        failedPayments={failedPayments.map((f) => ({
          id: f.id,
          createdAt: f.createdAt.toISOString(),
          meta: (f.meta ?? {}) as Prisma.JsonObject,
          user: f.user,
        }))}
        chartLabels={chartLabels}
        chartValues={chartValues}
      />
    </DashboardShell>
  )
}
