import { formatMpesaPhone, stkPush, type StkPushResult } from '@/lib/mpesa/daraja'

export type { StkPushResult }

export function formatPhone(raw: string): string {
  return formatMpesaPhone(raw)
}

export async function initiateStkPush(opts: {
  phone: string
  amount: number
  accountRef: string
  description: string
  callbackUrl: string
}): Promise<StkPushResult> {
  return stkPush({
    phone: opts.phone,
    amount: opts.amount,
    accountReference: opts.accountRef,
    description: opts.description,
    callbackUrl: opts.callbackUrl,
  })
}
