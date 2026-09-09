import type { MemberStatus, PaymentMethod } from '@prisma/client'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatMonthKey(key: string): string {
  const [year, month] = key.split('-')
  const m = Number(month)
  if (!year || !m || m < 1 || m > 12) return key
  return `${MONTH_NAMES[m - 1]} ${year}`
}

export function formatMonthKeys(keys: string[]): string[] {
  return keys.map(formatMonthKey)
}

export function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  BANK: 'Bank transfer',
  OTHER: 'Other',
}

export function formatPaymentMethod(method: PaymentMethod | string | null | undefined): string {
  if (!method) return 'Unknown'
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? String(method)
}

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  DECEASED: 'Deceased',
  RESIGNED: 'Resigned',
  DISQUALIFIED: 'Disqualified',
}

export function formatMemberStatus(status: MemberStatus | string): string {
  return MEMBER_STATUS_LABELS[status as MemberStatus] ?? String(status)
}

export function hasChartData(values: number[]): boolean {
  return values.length > 0 && values.some((v) => v > 0)
}

export function formatKes(value: number): string {
  return `KES ${Math.round(value).toLocaleString()}`
}
